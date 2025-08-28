import config from '../config.js';

export const testToolsPromptDefinition = {
	title: 'Test tools',
	description: 'Test tools prompt for testing purposes',
	argsSchema: {}
};

export function testToolsPrompt() {
	return {
		messages: [
			{
				role: 'user',
				content: {
					type: 'text',
					text: `Fes un test segur i ampli de les eines de ${config.SERVER_CONSTANTS.serverInfo.name}, sense modificar l'org ni l'espai de treball.

Objectiu: cridar el màxim de tools possibles només amb accions de lectura o que no persisteixin canvis. Evita qualsevol acció que creï, actualitzi, desplegui o esborri metadades o dades.

Inclou (en aquest ordre recomanat):

1) salesforceMcpUtils (només accions segures)
   - action: "getCurrentDatetime"
   - action: "getOrgAndUserDetails"
   - action: "getState" (només per validar que l'estat bàsic es retorna; no canvia res)
   - action: "loadRecordPrefixesResource" (només llegeix metadades via Apex i carrega un recurs en memòria)

2) getRecentlyViewedRecords
   - Desa el primer Id retornat (si n'hi ha) per a proves posteriors.

3) executeSoqlQuery (consulta lleugera i de lectura)
   - Consulta recomanada: "SELECT Id, Name FROM Account ORDER BY LastModifiedDate DESC LIMIT 5".
   - Si l'objecte Account no existeix a l'org, prova amb "Contact" o "User".

4) getRecord
   - Fes servir l'Id obtingut a (2). Si (2) no retorna res, fes servir un Id de (3).

5) describeObject
   - sObjectName: "Account" (o un estàndard disponible)
   - includeFields: false (prova lleugera)
   - Segona crida opcional: includeFields: true, includePicklistValues: false (si vols validar camps sense carregar massa dades)

6) apexDebugLogs (només accions no mutadores)
   - action: "status"
   - action: "list"
   - Si hi ha logs disponibles, action: "get" amb el primer Id retornat per "list" (si no n'hi ha, salta aquesta crida)

7) getSetupAuditTrail
   - lastDays: 7 (o 30). No passis paràmetres que filtrin per usuari si no cal.

8) getApexClassCodeCoverage
   - Abans, amb executeSoqlQuery, obtén fins a 3 noms d'ApexClass: "SELECT Name FROM ApexClass WHERE NamespacePrefix = NULL LIMIT 3".
   - Passa aquests noms a la tool encara que no tinguin cobertura; la tool retornarà l'estat actual.

9) executeAnonymousApex (sense canvis persistents)
   - apexCode: "System.debug('MCP safe test ping');"
   - mayModify: false

10) runApexTest (opcional, només si hi ha classes @isTest i per executar un sol test breu)
   - Amb executeSoqlQuery, busca una classe de test: "SELECT Name, Body FROM ApexClass WHERE Status = 'Active' AND NamespacePrefix = NULL ORDER BY LastModifiedDate DESC" i filtra localment per Body que contingui "@isTest".
   - Si en trobes una, crida runApexTest amb classNames: [nomClasse]. Si no n'hi ha, salta la prova de tests.
   - Nota: L'execució de tests a Salesforce no persisteix DML fora de context de test.

Al final, opcionalment, crida salesforceMcpUtils amb action: "clearCache" per netejar recursos carregats en memòria durant la prova.

Important: No cridis cap de les següents tools/accions perquè poden modificar l'org o l'espai de treball:
   - createMetadata (totes les accions)
   - deployMetadata
   - apexDebugLogs: accions "on" i "off"
   - Qualsevol tool o acció que creï, actualitzi o esborri dades/metadades
   - salesforceMcpUtils: "reportIssue" (fa una crida externa; no és necessària per a aquest test)

Comportament desitjat: per a cada crida, valida que la tool respon sense error i, quan apliqui, reutilitza resultats previs (p. ex. Id recuperat a getRecentlyViewedRecords) per alimentar la següent tool. Si alguna crida no pot completar-se (p. ex. objecte inexistent, cap log disponible), registra-ho i continua amb la resta de proves sense fallar.

Resum final: retorna un resum amb l'estat de cada crida (èxit/error) i qualsevol nota rellevant (p. ex. quants registres retornats, primer Id utilitzat, primer log obtingut, etc.).`
				}
			}
		]
	};
}
