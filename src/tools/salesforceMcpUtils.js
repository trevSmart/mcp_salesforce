import client from '../client.js';
import state from '../state.js';
import {log, textFileContent, formatDate} from '../utils.js';
import {z} from 'zod';
import {resources, newResource, clearResources} from '../mcp-server.js';
import config from '../config.js';
import {getOrgAndUserDetails, executeAnonymousApex} from '../salesforceServices.js';
import {readFile} from 'fs/promises';
import {existsSync, readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

export const salesforceMcpUtilsToolDefinition = {
	name: 'salesforceMcpUtils',
	title: 'IBM Salesforce MCP Utils',
	description: textFileContent('salesforceMcpUtils'),
	inputSchema: {
		action: z.enum(['clearCache', 'getCurrentDatetime', 'getState', 'reportIssue', 'loadRecordPrefixesResource', 'getOrgAndUserDetails'])
			.describe('The action to perform: "clearCache", "getCurrentDatetime", "getState", "reportIssue", "loadRecordPrefixesResource", "getOrgAndUserDetails"'),
		issueDescription: z.string()
			.optional()
			.describe('Detailed description of the issue (required for reportIssue action)'),
		issueToolName: z.string()
			.optional()
			.describe('Name of the tool that failed or needs improvement (optional)')
	},
	annotations: {
		readOnlyHint: false,
		idempotentHint: false,
		openWorldHint: false,
		title: 'IBM Salesforce MCP Utils'
	}
};

// Helper function to generate manual titles when sampling is not available
function generateManualTitle(description, toolName) {
	let title = 'Issue';

	if (toolName && toolName !== 'Unknown') {
		title += ` in ${toolName}`;
	}

	title += ': Technical problem reported';

	return title;
}

// Lightweight, deterministic intent → tool recommender to reduce agent reasoning time
// suggestToolFast removed to avoid extra tool-call overhead

export async function salesforceMcpUtilsToolHandler({action, issueDescription, issueToolName}) {
	try {
		if (action === 'clearCache') {
			clearResources();
			return {
				content: [{
					type: 'text',
					text: '✅ Successfully cleared cached resources'
				}],
				structuredContent: {action, status: 'success'}
			};

		} else if (action === 'getCurrentDatetime') {
			const now = new Date();
			const result = {
				now,
				nowLocaleString: now.toLocaleString(),
				nowIsoString: now.toISOString(),
				timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone
			};

			return {
				content: [{
					type: 'text',
					text: JSON.stringify(result, null, 2)
				}],
				structuredContent: result
			};

		} else if (action === 'getState') {
			const output = {
				state: {...state},
				client,
				resources
			};
			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved the internal state of the MCP server'
				}],
				structuredContent: output
			};

		} else if (action === 'loadRecordPrefixesResource') {
			const content = [];
			let structuredContent = {};
			let resourceUri = 'mcp://prefixes/recordPrefixes.csv';
			let data = [];
			const recordPrefixesResource = resources[resourceUri];
			if (recordPrefixesResource) {
				data = JSON.parse(recordPrefixesResource.text);
				content.push({type: 'text', text: '✅ Object record prefixes resource already loaded'});

			} else {
				// Read the Apex script file directly - buscar amb qualsevol extensió
				const staticDir = join(dirname(fileURLToPath(import.meta.url)), '../static');
				let apexScriptPath = null;

				if (existsSync(staticDir)) {
					const files = readdirSync(staticDir);
					const scriptFile = files.find(file => file.startsWith('retrieve-sobject-prefixes.'));
					if (scriptFile) {
						apexScriptPath = join(staticDir, scriptFile);
					}
				}

				if (!apexScriptPath) {
					throw new Error('No retrieve-sobject-prefixes file found in static directory');
				}

				const apexScript = await readFile(apexScriptPath, 'utf8');
				const result = await executeAnonymousApex(apexScript);
				if (result.success) {
					const resultLogs = result.logs;
					data = resultLogs.split('\n')
						.filter(line => line.trim() && line.includes('USER_DEBUG'))
						.map(line => {
							const lastPipeIndex = line.lastIndexOf('|');
							return lastPipeIndex !== -1 ? line.substring(lastPipeIndex + 1) : line;
						})
						.filter(line => line.trim()); // Remove any empty lines after processing

					// Create new resource
					newResource(
						resourceUri,
						'SObject record prefixes list',
						'This resource contains a list of SObject record prefixes.',
						'application/json',
						JSON.stringify(data, null, '\t'),
						{audience: ['user', 'assistant']}
					);

					content.push({type: 'text', text: '✅ Object record prefixes resource loaded successfully'});

				} else {
					throw new Error(`Failed to load record prefixes: ${result.error}`);
				}
			}

			// Transform the array data into the desired object format
			const transformedData = {};
			data.forEach(item => {
				const [objectName, prefix] = item.split(',');
				if (objectName && prefix) {
					transformedData[prefix] = objectName;
				}
			});

			if (client.supportsCapability('resource_links')) {
				content.push({type: 'resource_link', uri: resourceUri});
			}

			//This should only be necessary if client does not support resource_links
			//However testing shows that some clients cant read the resource_links properly even if they support it
			//For now we will always return the data as structured content
			structuredContent = transformedData;

			return {
				content,
				structuredContent
			};

		} else if (action === 'getOrgAndUserDetails') {
			const result = await getOrgAndUserDetails();
			return {
				content: [{
					type: 'text',
					text: 'Successfully retrieved the org and user details'
				}],
				structuredContent: result
			};

		} else if (action === 'reportIssue') {
			// Validate required fields for reportIssue
			if (!issueDescription || issueDescription.trim().length < 10) {
				throw new Error('For the reportIssue action, issueDescription is required and must be at least 10 characters long');
			}

			// Fix issue type as "bug" and derive title from description
			const issueType = 'bug';
			const cleanDescription = issueDescription.trim();

			// Try to generate title using sampling capability if available
			let title;
			let detectedToolName = issueToolName;

			// Fix severity to medium
			const issueSeverity = 'medium';

			// Import required dependencies at the beginning
			let mcpServer;
			try {
				const mcpServerModule = await import('../mcp-server.js');
				mcpServer = mcpServerModule.mcpServer;
			} catch (importError) {
				log(`Error importing mcp-server: ${importError.message}`, 'debug');
				mcpServer = null;
			}

			if (client.supportsCapability('sampling') && mcpServer) {
				try {
					// If no tool name specified, try to detect it from description
					if (!detectedToolName || detectedToolName === 'Unknown') {
						const toolDetectionPrompt = `## Issue Description ##
${issueDescription}

## Task ##
Analyze this issue description and determine which one of the MCP server's tools is most likely affected. Look for:
- Tool names mentioned (e.g., "executeSoqlQuery", "describeObject", "dmlOperation", "getSetupAuditTrail")
- Functionality described (e.g., "query execution", "object description", "record creation", "audit trail", "setup audit")
- Error messages that might indicate the tool
- Specific features mentioned (e.g., "Setup Audit Trail" → "getSetupAuditTrail")

If you can clearly identify the tool, return only the tool name.
If the description is unclear or could apply to multiple tools, return "Unknown".

Return only the tool name or "Unknown" without any explanation.`;

						const toolDetectionResponse = await mcpServer.server.createMessage({
							messages: [{role: 'user', content: {type: 'text', text: toolDetectionPrompt}}],
							systemPrompt: 'You are a Model Context Protocol expert. Analyze issue descriptions to identify which of the MCP server\'s tools is most likely affected.',
							modelPreferences: {speedPriority: 0, intelligencePriority: 1},
							maxTokens: 50
						});

						const detectedTool = toolDetectionResponse.content[0].text.trim();
						if (detectedTool && detectedTool !== 'Unknown' && detectedTool.length < 50) {
							detectedToolName = detectedTool;
						}
					}

					// Create sampling prompt for title generation
					const samplingPrompt = `## Issue Description ##\n${issueDescription}\n\n## Tool Information ##\nTool: ${detectedToolName}\nSeverity: ${issueSeverity || 'medium'}\n\n## Task ##\nGenerate a concise, descriptive title for this issue report. The title should be:\n- Clear and specific\n- Under 60 characters\n- Professional and technical\n- Focus on the main problem\n\nReturn only the title without any explanation or formatting.`;

					// Generate title using sampling capability
					const samplingResponse = await mcpServer.server.createMessage({
						messages: [{role: 'user', content: {type: 'text', text: samplingPrompt}}],
						systemPrompt: 'You are a technical issue report specialist. Generate concise, professional titles for technical issues.',
						modelPreferences: {speedPriority: 0, intelligencePriority: 1},
						maxTokens: 100
					});

					title = samplingResponse.content[0].text.trim();

					// Fallback if generated title is too long or empty
					if (!title || title.length > 60) {
						title = cleanDescription.length > 60 ? cleanDescription.substring(0, 60) + '...' : cleanDescription;
					}

				} catch (error) {
					log(`Error generating title with sampling: ${error.message}`, 'debug');
					// Fallback to manual title generation
					title = cleanDescription.length > 60 ? cleanDescription.substring(0, 60) + '...' : cleanDescription;
				}
			} else {
				// Manual title generation when sampling is not available
				title = generateManualTitle(cleanDescription, detectedToolName);
			}

			// Check if client supports elicitation and ask for confirmation before sending issue
			if (client.supportsCapability('elicitation') && mcpServer) {
				const elicitResult = await mcpServer.server.elicitInput({
					message: `⚠️ Please confirm that you want to report this issue.\n\nTitle: ${title}\n\nTool: ${detectedToolName}\n\nDescription: ${issueDescription}`,
					requestedSchema: {
						type: 'object',
						title: 'Report issue?',
						properties: {
							confirm: {
								type: 'string',
								enum: ['Yes', 'No'],
								enumNames: ['Report issue now', 'Cancel issue report'],
								description: 'Report this issue?',
								default: 'Yes'
							}
						},
						required: ['confirm']
					}
				});

				if (elicitResult.action !== 'accept' || elicitResult.content?.confirm !== 'Yes') {
					return {
						content: [{
							type: 'text',
							text: 'User has cancelled the issue report'
						}],
						structuredContent: elicitResult
					};
				}
			}

			// Prepare issue data
			const issueData = {
				type: issueType,
				title: title,
				description: issueDescription,
				toolName: detectedToolName,
				severity: 'medium',
				date: formatDate(new Date()),
				reportedBy: state.user?.name || process.env.USER || process.env.USERNAME || 'Unknown',
				environment: {
					os: process.platform === 'darwin' ? 'Mac OS' : process.platform,
					user: process.env.USER || process.env.USERNAME || 'Unknown',
					nodeVersion: process.version,
					mcpProtocolVersion: config.SERVER_CONSTANTS.protocolVersion
				},
				server: {
					serverInfo: config.SERVER_CONSTANTS.serverInfo,
					capabilities: config.SERVER_CONSTANTS.capabilities,
					workspacePath: state.workspacePath,
					org: state.org
				},
				client: {
					clientInfo: client.clientInfo,
					capabilities: client.capabilities
				}
			};

			// Test-friendly dry-run mode to avoid creating real issues from tests
			if (String(process.env.MCP_REPORT_ISSUE_DRY_RUN || '').toLowerCase() === 'true') {
				const fake = {
					success: true,
					issueId: 'DRY-RUN-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
					issueUrl: 'about:blank#dry-run',
					message: 'Dry run: issue not sent to webhook',
					request: {type: issueType, title, tool: detectedToolName, severity: issueSeverity}
				};
				return {
					content: [{type: 'text', text: '✅ Dry run: issue report simulated (no webhook call)'}],
					structuredContent: fake
				};
			}

			try {
				// Send issue to Netlify webhook
				log('Sending issue', 'info');
				const response = await fetch('https://mcp-salesforce-issue-webhook.netlify.app/.netlify/functions/report-issue', {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify(issueData)
				});

				if (response.ok) {
					const result = await response.json();

					if (result.success) {
						log(`Issue created successfully: ${result.issueUrl}`, 'info');

						return {
							content: [{
								type: 'text',
								text: `Issue ${result.issueId} successfully created`
							}],
							structuredContent: result
						};
					} else {
						throw new Error(`Webhook error: ${result.error || 'Unknown error'}`);
					}
				} else {
					throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
				}

			} catch (error) {
				log(error, 'error', 'Error sending issue');
				throw new Error(`Failed to send issue to webhook: ${error.message}`);
			}

		} else {
			throw new Error(`Invalid action: ${action}`);
		}

	} catch (error) {
		log(error, 'error', 'Error in salesforceMcpUtilsTool');
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}
