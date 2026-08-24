import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const package_json = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

describe('@tsrx/vscode-plugin package contract', () => {
	it('uses the TSRX marketplace identity', () => {
		expect(package_json).toMatchObject({
			name: '@tsrx/vscode-plugin',
			displayName: 'TSRX for VS Code',
			publisher: 'TSRX',
		});
		expect(package_json.scripts['pkg-name-release']).toContain('name tsrx-vscode-plugin');
		expect(JSON.stringify(package_json.contributes)).not.toMatch(/ripple/i);
	});

	it('enables Emmet completions for TSRX files by default', () => {
		const languages = /** @type {{ id: string, extensions: string[] }[]} */ (
			package_json.contributes.languages
		);
		const tsrx_language = languages.find((language) => language.extensions.includes('.tsrx'));

		expect(tsrx_language?.id).toBe('tsrx');
		expect(package_json.contributes.configurationDefaults).toMatchObject({
			'emmet.includeLanguages': {
				tsrx: 'html',
			},
			'emmet.showExpandedAbbreviation': 'always',
		});
	});
});
