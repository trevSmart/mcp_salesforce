import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {log} from './utils.js';
import state from './state.js';

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
	const browser = await chromium.launch({headless: true});
	const context = await browser.newContext({acceptDownloads: true});
	const page = await context.newPage();

	try {
		const {instanceUrl, accessToken} = state.org;
		const sid = encodeURIComponent(accessToken);
		const retURL = encodeURIComponent(setupSetupAuditTrailUrl);
		const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${sid}&retURL=${retURL}`;
		await page.goto(frontdoorUrl, {waitUntil: 'domcontentloaded'});
		await page.waitForURL(url => url.pathname.includes(setupSetupAuditTrailUrl), {timeout: 60000});

		log('Login successfull.', 'debug');

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

		log('Downloading CSV file...', 'debug');
		const downloadPromise = page.waitForEvent('download', {timeout: 60000});

		// Utilitzar clic directe en lloc de page.goto per evitar conflictes amb descàrregues
		await page.evaluate((link) => link.click(), downloadLink);

		const download = await downloadPromise;

		const fileName = `setupAuditTrail_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
		const filePath = path.join(os.tmpdir(), fileName);
		await download.saveAs(filePath);

		const fileContent = fs.readFileSync(filePath, 'utf8');

		log('Download completed.', 'debug');
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
		return await retrieveFile();

	} catch (error) {
		log(error, 'error', 'Error retrieving Setup Audit Trail file');
		throw error;
	}
}