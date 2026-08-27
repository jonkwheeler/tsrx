import { describe, expect, it } from 'vitest';
import { parseModule } from '../../src/index.js';

describe('local export scope lookup', () => {
	it('sees names appended after the scope cache is created', () => {
		const ast = parseModule(
			`const first = 1;
export { first };
const second = 2;
export { second };`,
			'export-scope-cache.tsrx',
		);

		expect(ast.body.filter((node) => node.type === 'ExportNamedDeclaration')).toHaveLength(2);
	});

	it('still rejects missing local exports', () => {
		expect(() => parseModule('export { missing };', 'export-scope-cache.tsrx')).toThrow(
			/Export 'missing' is not defined/,
		);
	});
});
