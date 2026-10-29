import { describe, expect, it } from 'vitest';
import { collect_folding_ranges } from '../src/foldingRangeHandler.js';

/**
 * Each fold as `<first line>-<last folded line> [kind] | <text of the first line>`, with
 * lines numbered from 1 the way an editor shows them. The line after the last folded one
 * stays visible: it holds the closing `}`, `</div>` or `)`.
 * @param {string} text
 */
function folds(text) {
	const lines = text.split('\n');
	return collect_folding_ranges(text, '/project/App.tsrx').map(
		({ startLine, endLine, kind }) =>
			`${startLine + 1}-${endLine + 1}${kind ? ` ${kind}` : ''} | ${lines[startLine].trim()}`,
	);
}

describe('folding ranges', () => {
	it('folds functions, template bodies, directive clauses, elements, style blocks, comments and regions', () => {
		const text = `// #region helpers
/**
 * Doc comment
 * spanning lines
 */
function helper(a: number) {
	const x = {
		a,
		b: 2,
	};
	return x;
}
// #endregion

export function App(props: { items: string[]; show: boolean }) @{
	const count = helper(1).a;
	<div class="app">
		<style>
			.app {
				color: red;
			}
		</style>
		@if (props.show) {
			<p>
				{'yes'}
			</p>
		} @else {
			<p>
				{'no'}
			</p>
		}
		@for (const item of props.items; key item) {
			<li>
				{item}
			</li>
		} @empty {
			<li>{'none'}</li>
		}
		@switch (count) {
			@case 1: {
				<b>{'one'}</b>
			}
			@default: {
				<i>{'other'}</i>
			}
		}
		@try {
			<span>
				{'ok'}
			</span>
		} @catch (e) {
			<span>{'err'}</span>
		}
	</div>
}
`;
		expect(folds(text)).toEqual([
			'1-13 region | // #region helpers',
			'2-5 comment | /**',
			'6-11 | function helper(a: number) {',
			'7-9 | const x = {',
			'15-54 | export function App(props: { items: string[]; show: boolean }) @{',
			'17-53 | <div class="app">',
			'18-21 | <style>',
			'23-26 | @if (props.show) {',
			'24-25 | <p>',
			'27-30 | } @else {',
			'28-29 | <p>',
			'32-35 | @for (const item of props.items; key item) {',
			'33-34 | <li>',
			'36-37 | } @empty {',
			'39-45 | @switch (count) {',
			'40-41 | @case 1: {',
			'43-44 | @default: {',
			'47-50 | @try {',
			'48-49 | <span>',
			'51-52 | } @catch (e) {',
		]);
	});

	it('folds the TypeScript constructs TSX folds', () => {
		const text = `import {
	a,
	b,
} from './x';
import c from './c';

enum E {
	A,
}
interface I {
	a: string;
}
namespace N {
	export const x = 1;
}
switch (a) {
	case 1:
		foo();
		break;
}
class Store {
	read(
		key: string,
	) {
		return key;
	}
}
const t = \`
line
\`;
foo(
	1,
);
const f = () =>
	a +
	b;
const v = (
	<input
		a="1"
		b="2"
	/>
);
// one
// two
call(); // trailing
/* one
 * two */
`;
		expect(folds(text)).toEqual([
			'1-5 imports | import {',
			'7-8 | enum E {',
			'10-11 | interface I {',
			'13-14 | namespace N {',
			'16-19 | switch (a) {',
			'17-19 | case 1:',
			'21-26 | class Store {',
			'22-25 | read(',
			'28-29 | const t = `',
			'31-32 | foo(',
			'34-36 | const f = () =>',
			'37-41 | const v = (',
			'38-40 | <input',
			'43-44 comment | // one',
			'46-47 comment | /* one',
		]);
	});

	it('folds `@else if` chains, `@pending` and fragments', () => {
		const text = `export function App(props: { a: boolean; b: boolean }) @{
	<>
		@if (props.a) {
			<p>{'a'}</p>
		} @else if (props.b) {
			<p>{'b'}</p>
		} @else {
			<p>{'c'}</p>
		}
		@try {
			<Child />
		} @pending {
			<p>{'loading'}</p>
		}
	</>
}
`;
		expect(folds(text)).toEqual([
			'1-15 | export function App(props: { a: boolean; b: boolean }) @{',
			'2-14 | <>',
			'3-4 | @if (props.a) {',
			'5-6 | } @else if (props.b) {',
			'7-8 | } @else {',
			'10-11 | @try {',
			'12-13 | } @pending {',
		]);
	});

	it('follows indentation and region markers while the file does not parse', () => {
		const text = `// #region app
export function App() @{
	@if (x) {
		<p>
			x
		</p>
}
// #endregion
`;
		expect(folds(text)).toEqual([
			'1-8 region | // #region app',
			'2-6 | export function App() @{',
			'3-6 | @if (x) {',
			'4-5 | <p>',
		]);
	});
});
