import { describe, expect, it } from 'vitest';
import { clone_ast_node } from '../../src/transform/jsx/ast-builders.js';

describe('clone_ast_node', () => {
	it('recursively clones dense arrays and strips locations', () => {
		const child = {
			type: 'Identifier',
			name: 'value',
			start: 1,
			end: 6,
			loc: {
				start: { line: 1, column: 1 },
				end: { line: 1, column: 6 },
			},
			metadata: { path: ['source'] },
		};
		const source = [child];

		const clone = clone_ast_node(source, false);

		expect(clone).not.toBe(source);
		expect(clone).toHaveLength(1);
		expect(clone[0]).toEqual({
			type: 'Identifier',
			name: 'value',
			metadata: { path: ['source'] },
		});
		expect(clone[0]).not.toBe(child);
		expect(clone[0].metadata).not.toBe(child.metadata);
		expect(source[0]).toBe(child);
	});
});
