import client from '../client.js';
import state from '../state.js';
import {log, textFileContent, formatDate} from '../utils.js';
import {z} from 'zod';
import {resources, newResource, clearResources} from '../mcp-server.js';
import config from '../config.js';
import {getOrgAndUserDetails} from '../salesforceServices.js';

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

export async function salesforceMcpUtilsToolHandler({action, options}) {
	try {
		if (action === 'clearCache') {
			clearResources();
			return {
				content: [{
					type: 'text',
					text: '✅ Cached resources cleared successfully'
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
			const recordPrefixesModule = await import('../static/record-prefixes.js');
			const recordPrefixes = recordPrefixesModule.default;
			const resource = newResource(
				'file://mcp/recordPrefixes.csv',
				'List of Salesforce record prefixes',
				'List of Salesforce record prefixes',
				'text/csv',
				recordPrefixes,
				{audience: ['assistant']}
			);

			return {
				content: [{
					type: 'text',
					text: '✅ Record prefixes resource loaded successfully'
				}],
				structuredContent: {resource}
			};

		} else if (action === 'getOrgAndUserDetails') {
			try {
				const result = await getOrgAndUserDetails();
				const content = [{
					type: 'text',
					text: JSON.stringify(result, null, 2)
				}];

				if (client.supportsCapability('embeddedResources')) {
					const resourceOrgAndUserDetails = newResource(
						'mcp://org/orgAndUserDetail.json',
						'Salesforce org and user details',
						'Details of the current target Salesforce org and logged-in user. This resource can now be reused instead of making new calls to the getOrgAndUserDetails tool.',
						'application/json',
						JSON.stringify(result, null, 3),
						{audience: ['user', 'assistant']}
					);
					content.push({type: 'resource', resource: resourceOrgAndUserDetails});
				}
				return {content, structuredContent: result};

			} catch (error) {
				log(error, 'error', 'Error getting org and user details');
				return {
					isError: true,
					content: [{
						type: 'text',
						text: `❌ Error getting org and user details: ${error.message}`
					}]
				};
			}

		} else if (action === 'reportIssue') {
			// Validate required fields for reportIssue
			if (!options?.issueDescription || options.issueDescription.trim().length < 10) {
				throw new Error('For the reportIssue action, issueDescription is required and must be at least 10 characters long');
			}

			// Fix issue type as "bug" and derive title from description
			const issueType = 'bug';
			const cleanDescription = options.issueDescription.trim();

			// Try to generate title using sampling capability if available
			let title;
			let detectedToolName = options.issueToolName;

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
${options.issueDescription}

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
					const samplingPrompt = `## Issue Description ##\n${options.issueDescription}\n\n## Tool Information ##\nTool: ${detectedToolName}\nSeverity: ${issueSeverity || 'medium'}\n\n## Task ##\nGenerate a concise, descriptive title for this issue report. The title should be:\n- Clear and specific\n- Under 60 characters\n- Professional and technical\n- Focus on the main problem\n\nReturn only the title without any explanation or formatting.`;

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
					message: 'Please confirm that you want to report this issue.',
					requestedSchema: {
						type: 'object',
						title: 'Report issue?',
						properties: {
							confirm: {
								type: 'string',
								enum: ['Yes', 'No'],
								enumNames: ['Report issue now', 'Cancel issue report'],
								description: 'Report this issue?',
								default: 'No'
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
				description: options.issueDescription,
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