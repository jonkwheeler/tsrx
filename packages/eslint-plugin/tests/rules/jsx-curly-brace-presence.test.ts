import { describe, expect, it } from 'vitest';
import { Linter, RuleTester } from 'eslint';
import rule from '../../src/rules/jsx-curly-brace-presence.js';
import * as parser from '@tsrx/eslint-parser';

const ruleTester = new RuleTester({
	languageOptions: {
		parser,
		parserOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			ecmaFeatures: { jsx: true },
		},
	},
});

/** A component whose template is `template`. */
const component = (template: string) => `export function A() @{\n\t${template}\n}`;

/**
 * Strings that TSRX text reads as syntax, with the element around them. Each
 * keeps its braces.
 */
const tsrx_syntax_children = [
	"<code>{'@for (item of items)'}</code>",
	"<code>{'@for await (item of items)'}</code>",
	"<p>{'Write @if (ok) before the block.'}</p>",
	"<code>{'@switch(kind)'}</code>",
	"<code>{'x@if (a)'}</code>",
	// A `{…}` after the text starts `@try`, and a block before it continues
	// `@else`, `@empty`, `@pending` and `@catch`.
	"<p>{'@try'} {1}</p>",
	"<p>@if (ok) {<b />} {'@else'}</p>",
	"<p>@for (const item of items) {<b />}{'@empty'}</p>",
	"<p>@try {<b />} @pending {<i />} {'@catch (e)'}</p>",
	"<code>{'//'}</code>",
	"<code>{'// note'}</code>",
	"<div>\n\t\t{'// something'}\n\t</div>",
	"<code>{'a // b'}</code>",
	"<code>{'/* note */'}</code>",
	'<code>{`/* note */`}</code>',
	'<code>{`// note`}</code>',
	'<code>{`@if (ok)`}</code>',
	// The new text would join the text beside it: `a //b` and `@if (x)`.
	"<p>a /{'/b'}</p>",
	"<p>{'@i'}f (x)</p>",
	"<p>{'@if'} (x)</p>",
	// The first child of a `<style>` decides whether it is a scoped style block.
	"<style>{'.card'}</style>",
	'<style>{`.card`}</style>',
];

const valid: RuleTester.ValidTestCase[] = [
	...tsrx_syntax_children.map((template) => component(template)),
	component("<p>{'a'}{'b'}</p>"),
	component("<p>{' padded '}</p>"),
	component("<p>{'{'}</p>"),
	component('<p>plain text</p>'),
	component('<a title="x" />'),
	// A dynamic tag's expression is no child or attribute.
	component('<{\'div\'} class="box" />'),
	{
		code: component('<style>.card { color: red; }</style>'),
		options: [{ children: 'always' }],
	},
	{
		code: component('<p>{"hello"}</p>'),
		options: ['always'],
	},
];

const invalid: RuleTester.InvalidTestCase[] = [
	{
		code: component("<p>{'plain text'}</p>"),
		output: component('<p>plain text</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component('<p>{`plain text`}</p>'),
		output: component('<p>plain text</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component("<p>{'user@example.com'}</p>"),
		output: component('<p>user@example.com</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component("<p>{'@iffy @ home @'}</p>"),
		output: component('<p>@iffy @ home @</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		// Without a `(`, `@if`, `@switch` and `@for` are text.
		code: component("<code>{'@if, @switch and @for'}</code>"),
		output: component('<code>@if, @switch and @for</code>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		// `@case` and `@default` are labels only in a `@switch` body, not in an element.
		code: component("<code>{'@case 1: @default:'}</code>"),
		output: component('<code>@case 1: @default:</code>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		// Away from a block, and without a `{…}` after `@try`, these are text.
		code: component("<code>{'@try, @else, @empty, @pending and @catch'}</code>"),
		output: component('<code>@try, @else, @empty, @pending and @catch</code>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component("<p>{'https://example.com'}</p>"),
		output: component('<p>https://example.com</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component("<p>{'a//b'}</p>"),
		output: component('<p>a//b</p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component('<p>{<b />}</p>'),
		output: component('<p><b /></p>'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		// TSRX reads an attribute string as JSX does.
		code: component("<a title={'@if (ok) // note'} />"),
		output: component('<a title="@if (ok) // note" />'),
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
	{
		code: component('<a title="x">hello</a>'),
		output: component('<a title={"x"}>{"hello"}</a>'),
		options: ['always'],
		errors: [{ messageId: 'missingCurly' }, { messageId: 'missingCurly' }],
	},
	{
		code: component('<a title={<b />} />'),
		output: component('<a title=<b /> />'),
		options: [{ propElementValues: 'never' }],
		errors: [{ messageId: 'unnecessaryCurly' }],
	},
];

ruleTester.run('jsx-curly-brace-presence', rule, { valid, invalid });

describe('jsx-curly-brace-presence --fix', () => {
	it('leaves every string that TSRX text reads as syntax in braces', () => {
		const linter = new Linter();
		for (const template of tsrx_syntax_children) {
			const code = component(template);
			const { output, messages } = linter.verifyAndFix(
				code,
				{
					files: ['**/*.tsrx'],
					languageOptions: { parser },
					plugins: { tsrx: { rules: { 'jsx-curly-brace-presence': rule } } },
					rules: { 'tsrx/jsx-curly-brace-presence': 'error' },
				},
				'App.tsrx',
			);
			expect({ template, output, messages }).toEqual({ template, output: code, messages: [] });
		}
	});

	it('writes TSRX that parses', () => {
		for (const { output } of invalid) {
			expect(() => parser.parseForESLint(output as string, { filePath: 'App.tsrx' })).not.toThrow();
		}
	});
});
