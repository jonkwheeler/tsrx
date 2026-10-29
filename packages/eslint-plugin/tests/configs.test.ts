import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import * as parser from '@tsrx/eslint-parser';
import plugin from '../src/index.ts';

const REPLACED_CORE_RULES = ['no-unused-vars', 'no-await-in-loop', 'no-unreachable'];

describe('eslint-plugin configs', () => {
	it('includes .tsrx files in TSRX configs', () => {
		const recommended_tsrx_config = plugin.configs.recommended[0];
		const strict_tsrx_config = plugin.configs.strict[0];

		expect(recommended_tsrx_config.files).toContain('**/*.tsrx');
		expect(strict_tsrx_config.files).toContain('**/*.tsrx');
		expect(recommended_tsrx_config.plugins).toHaveProperty('tsrx', plugin);
		expect(recommended_tsrx_config.rules).toHaveProperty('tsrx/control-flow-jsx');
		for (const config of [...plugin.configs.recommended, ...plugin.configs.strict]) {
			expect(config.name).not.toMatch(/ripple/i);
			expect(Object.keys(config.rules ?? {})).not.toContainEqual(expect.stringMatching(/ripple/i));
		}
	});

	it('swaps in the TSRX versions of core rules for .tsrx files only', () => {
		for (const configs of [plugin.configs.recommended, plugin.configs.strict]) {
			const [tsrx_files, typescript_files] = configs;
			for (const name of REPLACED_CORE_RULES) {
				expect(tsrx_files.rules[name]).toBe('off');
				expect(tsrx_files.rules[`tsrx/${name}`]).toBe('error');
				expect(typescript_files.rules).not.toHaveProperty(name);
				expect(typescript_files.rules).not.toHaveProperty(`tsrx/${name}`);
			}
		}
	});

	it('reports each problem once when listed after a config that enables the core rules', () => {
		const code = `export async function List({ items, n, load }) @{
	<ul>
		@for (const item of items; index i; key await load(item)) { <li>{item}</li> }
		@switch (n) {
			@case 1: { throw new Error('one'); }
			@default: { <i /> }
		}
	</ul>
}`;
		const messages = new Linter().verify(
			code,
			[
				// The rules `js.configs.recommended` enables, and `no-await-in-loop`.
				{ rules: Object.fromEntries(REPLACED_CORE_RULES.map((name) => [name, 'error'])) },
				...plugin.configs.recommended,
				{ files: ['**/*.tsrx'], languageOptions: { parser } },
			],
			'App.tsrx',
		);

		expect(
			messages.map((message) => `${message.line}:${message.column} ${message.ruleId}`),
		).toEqual(['3:36 tsrx/no-unused-vars', '3:43 tsrx/no-await-in-loop']);
	});
});
