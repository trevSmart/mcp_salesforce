import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import state from './state.js';
import {log} from './utils.js';

/** Espera fins que aparegui l'enllaç de descàrrega (document + iframes), amb polling curt */
async function waitForDownloadLink(page, totalTimeoutMs = 20000, intervalMs = 200) {
	const start = Date.now();

	const hasLink = async () => {
		let link = page.locator('a:has-text("Download setup audit trail")').first();
		if (await link.count()) { return link; }

		for (const fr of page.frames()) {
			const l = fr.locator('a:has-text("Download setup audit trail")').first();
			if (await l.count()) { return l; }
		}

		const sels = ['a[href*="csv"]', 'a[href*="download"]', 'a[href*="audit"]'];
		for (const sel of sels) {
			let alt = page.locator(sel).first();
			if (await alt.count()) { return alt; }
			for (const fr of page.frames()) {
				const fAlt = fr.locator(sel).first();
				if (await fAlt.count()) { return fAlt; }
			}
		}
		return null;
	};

	while (Date.now() - start < totalTimeoutMs) {
		const found = await hasLink();
		if (found) { return found; }
		await page.waitForTimeout(intervalMs);
	}
	return null;
}

async function retrieveFile() {
	const setupSetupAuditTrailUrl = '/lightning/setup/SecurityEvents/home';

	// Verificar que tenim les credencials necessàries
	if (!state.org?.user?.username) {
		throw new Error('No s\'ha trobat l\'usuari a l\'estat. Assegura\'t que l\'usuari està connectat a Salesforce.');
	}

	// Obtenir la URL de la instància i l'accessToken des de l'estat
	const instanceUrl = state.org?.instanceUrl;
	const accessToken = state.org?.accessToken;
	if (!instanceUrl || !accessToken) {
		throw new Error('No s\'ha trobat la URL de la instància o l\'accessToken a l\'estat. Assegura\'t que l\'usuari està connectat a Salesforce.');
	}

	// Iniciar el navegador
	const browser = await chromium.launch({headless: false});
	const context = await browser.newContext({acceptDownloads: true});
	const page = await context.newPage();

	try {
		// MODE TOKEN: salt directe via frontdoor.jsp
		log('Iniciant sessió via frontdoor.jsp (OAuth token)...', 'debug');
		const sid = encodeURIComponent(accessToken);
		const retURL = encodeURIComponent(setupSetupAuditTrailUrl);
		const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${sid}&retURL=${retURL}`;

		log(`Accedint via frontdoor: ${frontdoorUrl}`, 'debug');
		await page.goto(frontdoorUrl, {waitUntil: 'domcontentloaded'});
		await page.waitForURL(url => url.pathname.includes(setupSetupAuditTrailUrl), {timeout: 60000});

		log(`Sessió establerta. URL actual: ${page.url()}`, 'debug');

		/* VERSIÓ AMB INPUTS (COMENTADA)
		const loginUrl = 'https://test.salesforce.com';
		const password = 'trompeta5';

		// Verificar que tenim les credencials necessàries
		if (!state.org?.user?.username || !password) {
			throw new Error('No s\'han trobat les credencials d\'usuari (username/password) a l\'estat. Assegura\'t que l\'usuari està connectat a Salesforce.');
		}

		let landedUrl;

		log('Iniciant sessió a Salesforce via formulari...', 'debug');
		// MODE FORMULARI: el de tota la vida
		await page.goto(`${loginUrl}/`, {waitUntil: 'domcontentloaded'});

		await page.waitForSelector('#username', {timeout: 60000});
		await page.fill('#username', state.org?.user?.username);
		await page.fill('#password', password);

		await Promise.all([
			page.waitForURL(/\/lightning\//, {timeout: 60000}),
			page.click('#Login')
		]);

		landedUrl = page.url();
		log(`Login completat. URL aterrat: ${landedUrl}`, 'debug');

		// Domini correcte del SETUP
		const setupOrigin = computeSetupOrigin(landedUrl);
		const setupUrl = `${setupOrigin}${setupSetupAuditTrailUrl}`;

		log(`Domini Setup calculat: ${setupOrigin}`, 'debug');
		log(`Anant a Setup Audit Trail: ${setupUrl}`, 'debug');
		*/

		// Since we're using the frontdoor approach, we don't need to navigate to setupUrl
		// The page is already at the correct location after the frontdoor redirect
		//await page.goto(setupUrl, {waitUntil: 'domcontentloaded'});

		try {
			await page.waitForURL(new RegExp(`${setupSetupAuditTrailUrl.replace(/\//g, '\\/')}`), {timeout: 60000});
		} catch (error) {
			throw new Error(`No s'ha trobat l'enllaç de descàrrega a Setup Audit Trail. Error: ${error.message}`);
		}

		// Espera DIRECTA al link de descàrrega
		log('Esperant l\'enllaç de descàrrega d\'Audit Trail...', 'debug');
		const downloadLink = await waitForDownloadLink(page, 20000, 200);

		if (!downloadLink) {
			const allLinks = await page.locator('a').all();
			log(`No s'ha trobat l'enllaç. #enllaços trobats (document principal): ${allLinks.length}`, 'debug');
			for (let i = 0; i < Math.min(10, allLinks.length); i++) {
				const t = (await allLinks[i].textContent())?.trim() || '';
				const h = await allLinks[i].getAttribute('href') || 'sense href';
				log(`Enllaç ${i + 1}: text="${t}", href="${h}"`, 'debug');
			}
			throw new Error('No s\'ha trobat l\'enllaç de descàrrega a Setup Audit Trail.');
		}

		log('Descarregant el fitxer CSV...', 'debug');
		const downloadPromise = page.waitForEvent('download', {timeout: 60000});
		await downloadLink.click();
		const download = await downloadPromise;

		const fileName = `setupAuditTrail_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
		const filePath = path.join(state.tempPath, fileName);
		await download.saveAs(filePath);

		const fileContent = fs.readFileSync(filePath, 'utf8');

		log(`Fitxer descarregat a: ${filePath}`, 'debug');
		return fileContent;

	} catch (error) {
		console.error('Error durant la descàrrega:', error);
		throw error;

	} finally {
		await browser.close();
	}
}

export async function retrieveSetupAuditTrailFile() {
	try {
		log('Iniciant la descàrrega del CSV de Setup Audit Trail...', 'debug');

		// Descarregar el CSV
		const fileContent = await retrieveFile();
		return fileContent;

		/*
        // Processar el CSV
        console.log('Processant el CSV...');
        const options = {
            lastDays: 7,
            // Descomentar per filtrar per usuari o metadada específica
            // createdByName: 'Marc Pla',
            // metadataName: 'CC_Gestion_Derivar_SinClienteAsociado'
        };

        // const result = await processAuditTrailCsv(csvFilePath, options);
		*/

		// console.log(JSON.stringify(result, null, 2));

	} catch (error) {
		console.error('Error:', error);
		process.exit(1);
	}
}