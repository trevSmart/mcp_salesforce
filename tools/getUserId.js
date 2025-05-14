/*globals process */
import {runCliCommand} from './utils.js';

async function getUserId(args, _meta) {
	try {
		const progressToken = _meta?.progressToken;
		const {searchType, searchTerm} = args;

		if (!searchType) {
			throw new Error('searchType is required');
		}

		if (!['name', 'username', 'both'].includes(searchType)) {
			throw new Error('searchType must be one of: name, username, both');
		}

		if (!searchTerm) {
			throw new Error('searchTerm is required');
		}

		let soqlQuery = 'SELECT Id, Name, Username, Profile.Name, UserRole.Name FROM User';
		const conditions = [];

		if (searchType === 'name' || searchType === 'both') {
			conditions.push(`Name LIKE '%${searchTerm.replace(/'/g, '\\\'').replace(/%/g, '\\%')}%'`);
		}

		if (searchType === 'username' || searchType === 'both') {
			if (conditions.length > 0) {
				conditions.push('OR');
			}
			conditions.push(`Username LIKE '%${searchTerm.replace(/'/g, '\\\'').replace(/%/g, '\\%')}%'`);
		}

		if (conditions.length > 0) {
			soqlQuery += ' WHERE ' + conditions.join(' ');
		}

		soqlQuery += ' ORDER BY LastModifiedDate DESC LIMIT 1';

		console.error(`Executing user search query: ${soqlQuery}`);

		const command = `sf data query --query "${soqlQuery.replace(/"/g, '\"')}" -o ${process.env.username} --json`;
		const queryData = await runCliCommand(command);

		if (!queryData.result || !queryData.result.records) {
			throw new Error('Invalid response format from Salesforce CLI');
		}

		if (queryData.result.records.length === 0) {
			return {
				content: [{
					type: 'text',
					text: `❌ No users found matching '${searchTerm}'`
				}]
			};
		} else if (queryData.result.records.length > 1) {
			return {
				content: [{
					type: 'text',
					text: `❌ Found ${queryData.result.records.length} users matching '${searchTerm}'`
				}]
			};
		} else {
			const user = queryData.result.records[0];
			return {
				content: [
					{
						type: 'text',
						text: `✅ Found user ${user.Name} with Id ${user.Id} and username ${user.Username}`
					}
					// {
					// 	type: 'object',
					// 	object: {
					// 		user
					// 	}
					// }
				],
				user
			};
		}
		/*
		return {
			content: [{
				type: 'text',
				text: `✅ Found ${formattedResults.length} user(s).`
			}],
			success: true,
			records: formattedResults
		};
		*/

	} catch (error) {
		console.error('Error in getUserId:', error);

		const salesforceError = error.message.match(/ERROR at Row:\d+:Column:\d+.*$/);
		const errorMessage = salesforceError ? salesforceError[0] : error.message;

		return {
			content: [{
				type: 'text',
				text: errorMessage
			}],
			isError: true
		};
	}
}

export {getUserId};