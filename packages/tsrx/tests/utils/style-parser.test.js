import { describe, expect, it } from 'vitest';
import { parseStyle } from '../../src/index.js';

const location = {
	filename: 'App.tsrx',
	line: 1,
	column: 1,
};

describe('CSS parser', () => {
	it('preserves matcher results and offsets after comments and selector prefixes', () => {
		const source =
			'/* before */ <!-- old --> .root + span > a ~ button || input, ' +
			'[data-kind^="hero" i]:nth-child(2n + 1 of .item) { color : red; }';

		const stylesheet = parseStyle(source, location, {});

		expect(stylesheet.children).toMatchObject([
			{
				type: 'Rule',
				start: 26,
				end: 127,
				prelude: {
					start: 26,
					end: 110,
					children: [
						{
							children: [
								{
									selectors: [{ type: 'ClassSelector', name: 'root', start: 26, end: 31 }],
								},
								{ combinator: { name: '+', start: 32, end: 33 } },
								{ combinator: { name: '>', start: 39, end: 40 } },
								{ combinator: { name: '~', start: 43, end: 44 } },
								{ combinator: { name: '||', start: 52, end: 54 } },
							],
						},
						{
							children: [
								{
									selectors: [
										{
											type: 'AttributeSelector',
											name: 'data-kind',
											matcher: '^=',
											value: 'hero',
											flags: 'i',
											start: 62,
											end: 83,
										},
										{
											type: 'PseudoClassSelector',
											name: 'nth-child',
											start: 83,
											end: 110,
											args: {
												children: [
													{
														children: [
															{
																selectors: [
																	{
																		type: 'Nth',
																		value: '2n + 1 of ',
																		start: 94,
																		end: 104,
																	},
																	{
																		type: 'ClassSelector',
																		name: 'item',
																		start: 104,
																		end: 109,
																	},
																],
															},
														],
													},
												],
											},
										},
									],
								},
							],
						},
					],
				},
				block: {
					children: [
						{ type: 'Declaration', property: 'color', value: 'red', start: 113, end: 124 },
					],
				},
			},
		]);
	});

	it('matches percentages at a nonzero source offset', () => {
		const stylesheet = parseStyle('/* lead */ 50% { opacity: 0.5; }', location, {});

		expect(stylesheet.children).toMatchObject([
			{
				prelude: {
					start: 11,
					children: [
						{
							children: [
								{
									selectors: [{ type: 'Percentage', value: '50%', start: 11, end: 14 }],
								},
							],
						},
					],
				},
			},
		]);
	});

	it('produces identical public results in strict and loose mode for valid styles', () => {
		const source =
			'<!-- legacy --> .card[data-size$="large" s] > img { width: calc(100% - 1rem); }';

		expect(parseStyle(source, location, { loose: true })).toEqual(parseStyle(source, location, {}));
	});

	it('does not leak matcher state between parser invocations', () => {
		const sources = [
			'[data-state~="active" i] { color: green; }',
			'/* longer prefix */ :nth-child(odd of .row) { display: grid; }',
			'75.5% { opacity: 0.75; }',
		];

		for (const source of sources) {
			const first = parseStyle(source, location, {});
			parseStyle('.interleaved > span { color: blue; }', location, {});
			expect(parseStyle(source, location, {})).toEqual(first);
		}
	});

	it('distinguishes declarations from nested rules without losing delimiters', () => {
		const source = `.card {
			content: "literal } ; {";
			background: url("/assets/a;b{c}.svg");
			escaped: foo\\;bar;
			&:hover { color: red; }
			[data-x="a:b;c"] { color: blue; }
			@media (width > 40rem) { .child { display: grid; } }
			--tone: blue;
		}`;

		const [rule] = parseStyle(source, location, {}).children;
		expect(rule).toMatchObject({
			type: 'Rule',
			block: {
				children: [
					{ type: 'Declaration', property: 'content', value: '"literal } ; {"' },
					{
						type: 'Declaration',
						property: 'background',
						value: 'url("/assets/a;b{c}.svg")',
					},
					{ type: 'Declaration', property: 'escaped', value: 'foo\\\\;;bar' },
					{ type: 'Rule' },
					{ type: 'Rule' },
					{ type: 'Atrule', name: 'media' },
					{ type: 'Declaration', property: '--tone', value: 'blue' },
				],
			},
		});
	});

	it('does not read url function state from before the current value', () => {
		expect(() => parseStyle('@url(foo;bar);', location, {})).toThrow('Expected identifier');
	});
});
