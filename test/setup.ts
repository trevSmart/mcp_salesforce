import { beforeAll, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ⚠️ Aquest fitxer és només per a setup de tests. No hi fem gestió del client MCP global.

// Si realment vols tenir dades comunes, millor tenir-les en un mòdul separat
// (p. ex. `test-config.ts`) i importar-les als tests. Ho deixo aquí com a exemple,
// però recomanable moure-ho fora d'aquest setup.
export const TEST_CONFIG = {
	salesforce: {
		testAccountId: '001KN00000Ilrd9YAB',
		testContactId: '003KN00000abcdeYAB',
		testApexRestResourceData: {
			apexClassOrRestResourceName: 'TestRestResource'
		},
		testUser: 'u0190347@cc-caixabank.com.devservice'
	}
};

beforeAll(async () => {
	const artifactsDir = path.join(process.cwd(), '.test-artifacts');
	try {
		if (fs.existsSync(artifactsDir)) {
			fs.rmSync(artifactsDir, { recursive: true, force: true });
		}
	} catch (err) {
		console.error('No s’ha pogut netejar .test-artifacts:', err);
	}
});

// Helper per noms de fitxer
function slug(s: string) {
	return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// Escriu artifact a fitxer
function writeArtifact(testName: string, label: string, data: unknown) {
	const dir = path.join(process.cwd(), '.test-artifacts');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${Date.now()}_${slug(testName)}_${slug(label)}.json`);
	fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
	return file;
}

// Matcher personalitzat: si no és true, bolca `dump` a .test-artifacts
expect.extend({
	toBeTruthyAndDump(received: unknown, dump: unknown) {
		const pass = Boolean(received);
		if (pass) {
			return { pass: true, message: () => 'value was true' };
		}
		// biome-ignore lint/suspicious/noMisplacedAssertion: <és un expect.extend>
		const testName = expect.getState().currentTestName ?? 'unknown-test';
		// Handle undefined dump gracefully
		const dumpData = dump !== undefined ? dump : { received, error: 'dump was undefined' };
		const file = writeArtifact(testName, 'structuredContent', dumpData);
		return {
			pass: false,
			message: () => `expected true, got ${String(received)}. Dump guardat a: ${file}`
		};
	}
});

declare module 'vitest' {
	interface Assertion {
		toBeTrueAndDump(dump: unknown): void;
	}
}
