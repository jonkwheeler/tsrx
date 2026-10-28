import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import plugin from '../src/index.ts';

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

	it('uses tsrx/jsx-curly-brace-presence for .tsrx files in place of the react rule', () => {
		for (const configs of [plugin.configs.recommended, plugin.configs.strict]) {
			const [tsrx_config, typescript_config] = configs;
			expect(tsrx_config.rules).toMatchObject({
				'tsrx/jsx-curly-brace-presence': 'error',
				'react/jsx-curly-brace-presence': 'off',
			});
			expect(typescript_config.rules).not.toHaveProperty('tsrx/jsx-curly-brace-presence');

			// A rule that is off needs no plugin, so the config works without
			// eslint-plugin-react.
			const messages = new Linter().verify(
				`export function A() @{
	<>
		<p>{'plain'}</p>
		<code>{'@for (item of items)'}</code>
	</>
}`,
				configs,
				'App.tsrx',
			);
			expect(messages.map((message) => `${message.line}: ${message.ruleId}`)).toEqual([
				'3: tsrx/jsx-curly-brace-presence',
			]);
		}
	});
});
