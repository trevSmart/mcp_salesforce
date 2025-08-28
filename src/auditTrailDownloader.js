import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';
import {log} from './utils.js';
import state from './state.js';

// Try clicking the first candidate link found across page and frames
async function clickDownloadCandidate(page, timeoutPerClick = 1000) {
	const selectors = [
		'a:has-text("Download setup audit trail")',
		'a[href*="csv"]',
		'a[href*="download"]',
		'a[href*="audit"]'
	];

	const contexts = [page, ...page.frames()];
	for (const sel of selectors) {
		for (const ctx of contexts) {
			try {
				const loc = ctx.locator(sel).first();
				if (await loc.count()) {
					await loc.click({timeout: timeoutPerClick});
					return true;
				}
			} catch {
				// ignore and try next candidate
			}
		}
	}
	return false;
}

async function retrieveFile() {
	let browser = null;
	try {
		const setupUrl = '/lightning/setup/SecurityEvents/home';
		browser = await chromium.launch({headless: true});

		// Ensure tmp directory
		const tmpDir = path.join(process.cwd(), 'tmp');
		fs.existsSync(tmpDir) || fs.mkdirSync(tmpDir, {recursive: true});

		const context = await browser.newContext({acceptDownloads: true, downloadsPath: tmpDir});
		const page = await context.newPage();

		const {instanceUrl, accessToken} = state.org;
		const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}&retURL=${encodeURIComponent(setupUrl)}`;
		await page.goto(frontdoorUrl, {waitUntil: 'domcontentloaded'});
		await page.waitForURL(url => url.pathname.includes(setupUrl), {timeout: 60000});


		// Attempt clicking candidates while waiting for a download event
		const download = await Promise.race([
			(async () => {
				const dl = await page.waitForEvent('download', {timeout: 60000});
				return dl;
			})(),
			(async () => {
				const start = Date.now();
				const maxWaitMs = 20000;
				while (Date.now() - start < maxWaitMs) {
					const clicked = await clickDownloadCandidate(page);
					if (clicked) {
						// Give the browser a short moment to emit the download event
						await page.waitForTimeout(50);
					}
					await page.waitForTimeout(200);
				}
				throw new Error('Download link not found in Setup Audit Trail.');
			})()
		]);

		const filePath = path.join(tmpDir, 'SetupAuditTrail.csv');
		await download.saveAs(filePath);
		return filePath;

	} catch (error) {
		log(error, 'error', 'Error during Setup Audit Trail download');
		throw error;

	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

async function retrieveFileWithRetry(maxRetries = 2) {
	let lastError;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			log(`Attempt ${attempt}/${maxRetries} to retrieve Setup Audit Trail file`, 'info');
			return await retrieveFile();
		} catch (error) {
			lastError = error;
			const transient = typeof error?.message === 'string'
				&& (error.message.includes('Frame was detached') || error.message.includes('Target page, context or browser has been closed'));
			if (transient && attempt < maxRetries) {
				log(`Transient error on attempt ${attempt}, retrying...`, 'warning');
				await new Promise(r => setTimeout(r, 2000));
				continue;
			}
			break;
		}
	}
	log(`All ${maxRetries} attempts failed. Last error: ${lastError?.message}`, 'error');
	throw lastError;
}

export async function retrieveSetupAuditTrailFile() {
	try {
		return await retrieveFileWithRetry();
	} catch (error) {
		log(error, 'error', 'Error retrieving Setup Audit Trail file');
		throw error;
	}
}
