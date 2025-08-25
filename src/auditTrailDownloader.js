import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import state from './state.js';
import {log} from './utils.js';
import os from 'os';

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

	// Iniciar el navegador amb opcions més robustes
	const browser = await chromium.launch({
		headless: false,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-accelerated-2d-canvas',
			'--no-first-run',
			'--no-zygote',
			'--disable-gpu'
		]
	});

	const context = await browser.newContext({
		acceptDownloads: true,
		viewport: {width: 1920, height: 1080},
		userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
	});

	const page = await context.newPage();

	try {
		// MODE TOKEN: salt directe via frontdoor.jsp
		log('Iniciant sessió via OAuth token...', 'debug');
		const sid = encodeURIComponent(accessToken);
		const retURL = encodeURIComponent(setupSetupAuditTrailUrl);
		const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${sid}&retURL=${retURL}`;
		page.goto(frontdoorUrl);
		await page.waitForURL(url => url.pathname.includes(setupSetupAuditTrailUrl), {timeout: 30000});
		log('Pàgina d\'Audit Trail carregada.', 'debug');

		// Esperar que la pàgina es carregui completament
		await page.waitForLoadState('domcontentloaded', {timeout: 60000});
		// Donar temps extra per a que els components Lightning es carreguin
		await page.waitForTimeout(3000);

		log('Buscant l\'enllaç de descàrrega...', 'debug');

		let downloadLink = null;
		let frame = page;
		const frames = page.frames();

		// Buscar en cada iframe
		for (let i = 0; i < frames.length; i++) {
			try {
				const frameElement = await frames[i].locator('div.pShowMore > a').first();
				if (frameElement) {
					downloadLink = frameElement;
					frame = frames[i];
					log(`Enllaç trobat en frame ${i}`, 'debug');
					break;
				}
			} catch {
				log(`Frame ${i}: element no trobat`, 'debug');
			}
		}

		log('Enllaç de descàrrega d\'Audit Trail trobat', 'debug');
		log('');
		log(`frame type: ${typeof frame}`, 'debug');
		log(`frame constructor: ${frame?.constructor?.name}`, 'debug');
		log('');
		log(`downloadLink type: ${typeof downloadLink}`, 'debug');
		log(`downloadLink constructor: ${downloadLink?.constructor?.name}`, 'debug');
		log('');
		const element = await downloadLink.elementHandle();
		log(`element type: ${typeof element}`, 'debug');
		log(`element constructor: ${element?.constructor?.name}`, 'debug');

		// Obtenir la URL de l'enllaç de descàrrega
		// Primer obtenir l'element real del Locator
		if (!element) {
			throw new Error('No s\'ha pogut obtenir l\'element de l\'enllaç de descàrrega');
		}

		const href = await element.getAttribute('href');
		if (!href) {
			throw new Error('No s\'ha pogut obtenir la URL de l\'enllaç de descàrrega');
		}

		log(`URL de descàrrega: ${href}`, 'debug');

		// Configurar l'espera de la descàrrega abans de fer clic
		const downloadPromise = page.waitForEvent('download', {timeout: 30000});

		// Fer clic utilitzant el frame correcte
		await page.goto(href);

		const download = await downloadPromise;
		log('Descàrrega iniciada', 'debug');

		const fileName = `setupAuditTrail_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
		const filePath = path.join(os.tmpdir(), fileName);

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

	} catch (error) {
		log(`Error durant la descàrrega: ${error.message}`, 'warn');
		throw error;
	}
}