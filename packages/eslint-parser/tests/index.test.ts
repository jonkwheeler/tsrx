import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { DIAGNOSTIC_CODES } from '@tsrx/core';
import * as parser from '../src/index.ts';
import { parseForESLint } from '../src/index.ts';

function lint(code: string, config: Linter.Config = {}) {
	return new Linter()
		.verify(code, { files: ['**/*.tsrx'], languageOptions: { parser }, ...config }, 'App.tsrx')
		.map((message) => `${message.line}: ${message.ruleId}: ${message.message}`);
}

describe('eslint-parser', () => {
	it('throws collected broken-markup diagnostics as ESLint parse errors', () => {
		expect(() =>
			parseForESLint(`export function App() { return <div><span></div>; }`, {
				filePath: 'App.tsrx',
			}),
		).toThrow(/Expected closing tag to match opening tag/);
	});

	it('keeps forgotten statement-container hints available to ESLint rules', () => {
		const result = parseForESLint(
			`export function UserBadge({ user }: UserBadgeProps): JSX.Element {
				const initials = user.name.slice(0, 2).toUpperCase();

				<button title={user.name}>{initials}</button>
			}`,
			{ filePath: 'App.tsrx' },
		);

		expect(result.ast.type).toBe('Program');
		expect(result.services?.tsrxDiagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DIAGNOSTIC_CODES.FORGOTTEN_STATEMENT_CONTAINER,
				}),
			]),
		);
	});

	it('lints @switch cases with no rules enabled', () => {
		expect(
			lint(`export function App(n) @{
				@switch (n) {
					@case 1: { <div /> }
					@case 2: { <p /> }
				}
			}`),
		).toEqual([]);
		expect(
			lint(`export function App(n) @{
				@switch (n) {
					@default: { <div /> }
				}
			}`),
		).toEqual([]);
	});

	it('gives ESLint the comments, so directive comments apply', () => {
		let comment_count = 0;
		const messages = lint(
			`// eslint-disable-next-line no-unused-vars
const unused = 1;
/* eslint-disable-next-line no-unused-vars */
const alsoUnused = 2;
const reported = 3;

export function App() @{
	<div />
}
`,
			{
				plugins: {
					probe: {
						rules: {
							comments: {
								create: (context) => ({
									Program() {
										comment_count = context.sourceCode.getAllComments().length;
									},
								}),
							},
						},
					},
				},
				rules: { 'no-unused-vars': 'error', 'probe/comments': 'error' },
			},
		);

		expect(messages).toEqual(["5: no-unused-vars: 'reported' is assigned a value but never used."]);
		expect(comment_count).toBe(2);
	});

	it('gives ESLint tokens, so no-unused-vars reports an unused parameter', () => {
		expect(lint(`export function f(unused) {}`, { rules: { 'no-unused-vars': 'error' } })).toEqual([
			"1: no-unused-vars: 'unused' is defined but never used.",
		]);
	});

	it('gives ESLint espree-style tokens for TSRX syntax', () => {
		const code = `export function App(n) @{
	<p class="a">
		{\`#\${n}\`} // note
		@if (n) { <><style>.b {}</style><b /></> }
	</p>
}`;
		const { tokens, comments } = parseForESLint(code, { filePath: 'App.tsrx' }).ast as any;

		expect(tokens.map((token: any) => `${token.type} ${token.value}`)).toEqual([
			'Keyword export',
			'Keyword function',
			'Identifier App',
			'Punctuator (',
			'Identifier n',
			'Punctuator )',
			'Punctuator @',
			'Punctuator {',
			'Punctuator <',
			'JSXIdentifier p',
			'JSXIdentifier class',
			'Punctuator =',
			'JSXText "a"',
			'Punctuator >',
			'JSXText \n\t\t',
			'Punctuator {',
			'Template `#${',
			'Identifier n',
			'Template }`',
			'Punctuator }',
			'JSXText  ',
			'Punctuator @',
			'Keyword if',
			'Punctuator (',
			'Identifier n',
			'Punctuator )',
			'Punctuator {',
			'Punctuator <',
			'Punctuator >',
			'Punctuator <',
			'JSXIdentifier style',
			'Punctuator >',
			'JSXText .b {}',
			'Punctuator <',
			'Punctuator /',
			'JSXIdentifier style',
			'Punctuator >',
			'Punctuator <',
			'JSXIdentifier b',
			'Punctuator /',
			'Punctuator >',
			'Punctuator <',
			'Punctuator /',
			'Punctuator >',
			'Punctuator }',
			'Punctuator <',
			'Punctuator /',
			'JSXIdentifier p',
			'Punctuator >',
			'Punctuator }',
		]);
		const comment_start = code.indexOf('// note');
		expect(comments).toEqual([
			expect.objectContaining({
				type: 'Line',
				value: ' note',
				range: [comment_start, comment_start + '// note'.length],
			}),
		]);

		// Every character outside whitespace and comments is in a token, and each
		// `loc` matches its `range`.
		const lines = code.split('\n');
		let position = 0;
		for (const item of [...tokens, ...comments].sort((a, b) => a.range[0] - b.range[0])) {
			expect(code.slice(position, item.range[0]).trim()).toBe('');
			const text = code.slice(item.range[0], item.range[1]);
			const { start, end } = item.loc;
			expect(lines[start.line - 1].startsWith(text.split('\n')[0], start.column)).toBe(true);
			expect(lines[end.line - 1].slice(0, end.column).endsWith(text.split('\n').at(-1)!)).toBe(
				true,
			);
			position = item.range[1];
		}
		expect(code.slice(position).trim()).toBe('');
	});
});
