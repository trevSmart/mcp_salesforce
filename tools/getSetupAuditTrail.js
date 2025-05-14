import {runCliCommand} from './utils.js';
const SOQL_LIMIT = 10000;

async function getSetupAuditTrail({lastDays, createdByName, metadataName}) {
	try {
		let soqlQuery = 'SELECT Section, CreatedDate, CreatedBy.Name, Display FROM SetupAuditTrail';
		let shouldFilterByMetadataName = metadataName && metadataName.trim() !== '';

		let conditions = ['CreatedById != NULL'];

		if (lastDays) {
			conditions.push(`CreatedDate >= LAST_N_DAYS:${lastDays}`);
		}

		if (createdByName) {
			conditions.push(`CreatedBy.Name = '${createdByName.replace(/'/g, "\\'")}'`);
		}

		if (conditions.length > 0) {
			soqlQuery += ' WHERE ' + conditions.join(' AND ');
		}

		soqlQuery += ` ORDER BY CreatedDate DESC LIMIT ${SOQL_LIMIT}`;

		// Netegem la query substituint salts de línia i tabulacions per espais
		const cleanQuery = soqlQuery.replace(/[\n\t\r]+/g, ' ').trim();

		const command = `sf data query --query "${cleanQuery.replace(/"/g, '\\"')}" -o ${process.env.username} --json`;
		console.error(`Executing SOQL query command: ${command}`);
		const response = await runCliCommand(command);

		if (!response || !response.result || !Array.isArray(response.result.records)) {
			throw new Error('No response or invalid response from Salesforce CLI');
		}

		//Validar i transformar cada registre
		const validRecords = response.result.records.map((record, index) => {
			if (record && typeof record === 'object'
				&& record.Section
				&& record.CreatedDate
				&& record.CreatedBy
				&& record.CreatedBy.Name) {
				return record;
			}
		}).filter(record => record !== null);

		if (validRecords.length === 0) {
			return {
				content: [{
					type: 'text',
					text: 'No valid records found in response'
				}]
			};
		}

		const ignoredSections = [
			'Manage Users', 'Customize Activities', 'Connected App Session Policy',
			'Translation Workbench', 'CBK Configs', 'Security Controls'
		];
		const sizeBeforeFilters = response.result.totalSize;
		let results = validRecords.filter(r => {
			if (!r || typeof r !== 'object'
			|| !r.Section || ignoredSections.includes(r.Section)
			|| (shouldFilterByMetadataName && r.Display && !r.Display.toLowerCase().includes(metadataName.toLowerCase()))
			) {
				console.error('Invalid record:', r);
				return false;
			}
			return true;
		});

		const transformedResults = results.reduce((acc, record) => {
			if (!record || typeof record !== 'object') {
				console.error('Invalid record during transformation:', record);
				return null;
			}

			const userName = record.CreatedBy && record.CreatedBy.Name ? record.CreatedBy.Name : 'Unknown User';
			if (!acc[userName]) {
				acc[userName] = [];
			}

			const d = new Date(record.CreatedDate);
			if (isNaN(d.getTime())) {
				console.error('Invalid date:', record.CreatedDate);
				return null;
			}

			const day = d.getDate().toString().padStart(2, '0');
			const month = (d.getMonth() + 1).toString().padStart(2, '0');
			const year = d.getFullYear().toString().slice(-2);
			const hour = d.getHours().toString().padStart(2, '0');
			const minute = d.getMinutes().toString().padStart(2, '0');

			let section = (record.Section || '').replace(/Apex Class/g, 'Apex');
			let display = (record.Display || '').replace(/Lightning Web Component/g, 'LWC');
			display = display.replace(/Aura Component/g, 'Aura');

			acc[userName].push(`${day}/${month}/${year} ${hour}:${minute} - ${section} - ${display}`);

			return acc;
		}, {});

		let formattedResult = {
			sizeBeforeFilters,
			sizeAfterFilters: results.length,
			records: transformedResults
		};

		if (sizeBeforeFilters === SOQL_LIMIT) {
			formattedResult.warning = `The number of query results is equal to the set limit (${SOQL_LIMIT}), so there might be additional records that were not returned.`;
		}

		return {
			content: [{
				type: 'text',
				text: `✅ Setup audit trail history: ${JSON.stringify(formattedResult, null, '\t')}`
			}]
		};

	} catch (error) {
		console.error('Error in getSetupAuditTrail:', error);
		return {
			isError: true,
			content: [{
				type: 'text',
				text: `❌ Error: ${error.message}`
			}]
		};
	}
}

export {getSetupAuditTrail};