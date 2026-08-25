import { describe, expect, it } from 'vitest';
import { clone_ast_node } from '../../src/transform/jsx/ast-builders.js';

describe('clone_ast_node', () => {
	it('preserves array holes while recursively cloning present elements', () => {
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
		const source = new Array(4);
		source[1] = child;
		source[3] = undefined;

		const clone = clone_ast_node(source, false);

		expect(clone).not.toBe(source);
		expect(clone).toHaveLength(4);
		expect(0 in clone).toBe(false);
		expect(1 in clone).toBe(true);
		expect(2 in clone).toBe(false);
		expect(3 in clone).toBe(true);
		expect(clone[1]).toEqual({
			type: 'Identifier',
			name: 'value',
			metadata: { path: ['source'] },
		});
		expect(clone[1]).not.toBe(child);
		expect(clone[1].metadata).not.toBe(child.metadata);
		expect(source[1]).toBe(child);
	});
});
