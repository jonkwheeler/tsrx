import fs from 'node:fs';
import { withPlatformTypes } from '@tsrx/core';
import { describe, expect, it } from 'vitest';
import { share_platform_globals } from '../src/platform-globals.js';

const code = 'export const web = import.meta.env.platform.web;\n';

/** @param {unknown} platform */
function generated(platform) {
	return withPlatformTypes(
		{
			code,
			mappings: [],
			cssMappings: [],
			scriptMappings: [],
			errors: [],
			sourceAst: /** @type {any} */ (null),
		},
		platform,
	).code;
}

describe('share_platform_globals', () => {
	it('blanks the copy in place and imports the shared file for each platform', () => {
		for (const [platform, name] of [
			['web', 'web'],
			['ios', 'ios'],
			['android', 'android'],
			[undefined, 'unconfigured'],
		]) {
			const text = generated(platform);
			const shared = share_platform_globals(text);
			const [blanked, line] = [shared.slice(0, text.length), shared.slice(text.length)];
			// Every generated offset stays put: only the block turns into spaces.
			expect(blanked.split('\n').length).toBe(text.split('\n').length);
			expect(blanked.replace(/ +\n/g, '\n').replace(/\n+/g, '\n')).toBe(`${code}export {};\n`);
			const match = /^\nimport type \{\} from "(.+)";\n$/.exec(line);
			expect(match?.[1]).toMatch(new RegExp(`/platform-globals/${name}\\.cjs$`));
			const declaration = fs.readFileSync(
				/** @type {string} */ (match?.[1]).replace(/\.cjs$/, '.d.cts'),
				'utf8',
			);
			// The shared file declares the copy it replaces.
			const copy = text.slice(text.indexOf('declare global'));
			expect(declaration.replace(/\s+/g, '')).toContain(copy.replace(/\s+/g, ''));
		}
	});

	it('leaves text without the exact copy unchanged', () => {
		const text = generated('web');
		for (const other of [
			code,
			text.replace('readonly ios: false', 'readonly ios: true'),
			text.replace('readonly [key:', 'readonly url: string;\n\t\treadonly [key:'),
		]) {
			expect(share_platform_globals(other)).toBe(other);
		}
	});
});
