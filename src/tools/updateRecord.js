import {getOrgDescription} from '../../index.js';
import {runCliCommand} from '../utils.js';

async function updateRecord({sObjectName, recordId, fields}) {
	try {
		//Utilitzem els camps directament si ja són un objecte, si no, intentem parsejar-los
		const fieldsObject = typeof fields === 'string' ? JSON.parse(fields) : fields;

		//Convertir els camps a format "Camp1='Valor1' Camp2='Valor2'"
		const valuesString = Object.entries(fieldsObject)
			.map(([key, value]) => `${key}='${value}'`)
			.join(' ');

		//Executar la comanda CLI
		const command = `sf data update record --sobject ${sObjectName} --where "Id='${recordId}'" --values "${valuesString}" -o ${getOrgDescription().alias} --json`;
		await runCliCommand(command);

		return {
			content: [
				{
					type: 'text',
					text: `Registre ${recordId} de l'objecte ${sObjectName} actualitzat correctament`
				}
			]
		};
	} catch (error) {
		return {
			content: [
				{
					type: 'text',
					text: `Error actualitzant el registre ${recordId} de l'objecte ${sObjectName}: ${error.message}`
				}
			]
		};
	}
}

export {updateRecord};