import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { create_tsrx_content_mapper } from '../src/mapper.js';
import { to_verification_mappings } from '../src/span-mappings.js';
import { consumer_fixture_dir } from './fixture-utils.js';

/** @import {VerificationMapping} from '../src/protocol.js' */

/**
 * Code whose printed form differs from the source in many ways: respaced
 * literals and type arguments, comments the printer leaves out, a blank line
 * after `return;`, loops, spreads and index signatures. It is also valid
 * TypeScript, so `tsc` on the same text as a `.ts` file is the reference.
 */
const SAMPLE = [
	'declare function g<T extends string>(): void;',
	'g<{}>();',
	'export const t = [ {}, [] ] satisfies number[];',
	'export const u: number[] = [ [ 1 ] ];',
	'declare const o: { a: number };',
	'export const x = [ /*comment*/ 1 as string ];',
	"export const y: number[] = [ /* c */ o.a + 'x' ];",
	'export const w = { /* comment */ a: 1 as string };',
	'declare const s: string | undefined;',
	'export const v = { /* c */ ...s };',
	"export const z: number[] = [ ...['x'] ];",
	'export type T = { /*comment*/ [x: string]: string; [x: string]: number };',
	'export const b = () => { while (true) { return; break; } };',
	'export function j() { for (const k of [1]) { return; continue; } }',
	'export function f(c: number, d: string) {',
	'\tif (c) c = d',
	'\tfor (;;) {',
	'\t\treturn;',
	'\t\tbreak;',
	'\t}',
	'}',
	"export const p: Record<{}, 1> = { 'a': 2 };",
	'',
].join('\n');

/**
 * A checker that rejects approximate ranges: a range's start maps through a
 * segment that starts there or holds it on equal-length text, and its end
 * through one that ends there or holds it. Undefined when no segment maps an
 * end, or two map it differently.
 * @param {VerificationMapping[]} segments
 * @param {number} start
 * @param {number} end
 * @returns {[number, number] | undefined}
 */
function map_range(segments, start, end) {
	/** @param {number} offset @param {boolean} at_end */
	const map = (offset, at_end) => {
		const found = new Set();
		for (const [gs, gl, os, ol] of segments) {
			if (at_end ? offset === gs + gl : offset === gs) found.add(at_end ? os + ol : os);
			else if (gl === ol && gs < offset && offset < gs + gl) found.add(os + offset - gs);
		}
		return found.size === 1 ? /** @type {number} */ ([...found][0]) : undefined;
	};
	const mapped_start = map(start, false);
	const mapped_end = map(end, true);
	return mapped_start === undefined || mapped_end === undefined
		? undefined
		: [mapped_start, mapped_end];
}

/**
 * Semantic and syntactic diagnostics of `files` (name → text) as
 * `[file, start, end, code]`.
 * @param {Record<string, string>} files
 */
function check(files) {
	const options = {
		strict: true,
		noEmit: true,
		allowUnreachableCode: false,
		target: ts.ScriptTarget.ES2022,
		types: [],
	};
	const host = ts.createCompilerHost(options);
	const read = host.readFile.bind(host);
	const get = host.getSourceFile.bind(host);
	host.fileExists = (name) => name in files || ts.sys.fileExists(name);
	host.readFile = (name) => files[name] ?? read(name);
	host.getSourceFile = (name, language) =>
		name in files ? ts.createSourceFile(name, files[name], language, true) : get(name, language);
	const program = ts.createProgram(Object.keys(files), options, host);
	return ts
		.getPreEmitDiagnostics(program)
		.filter((d) => d.file && d.file.fileName in files)
		.map((d) => [
			/** @type {ts.SourceFile} */ (d.file).fileName,
			/** @type {number} */ (d.start),
			/** @type {number} */ (d.start) + /** @type {number} */ (d.length),
			d.code,
		]);
}

describe('verificationMappings', () => {
	/**
	 * @param {Record<string, unknown>} [options]
	 * @param {string} [content]
	 */
	function transform(options, content = SAMPLE) {
		const mapper = create_tsrx_content_mapper();
		mapper.openProject({
			configFileName: path.join(consumer_fixture_dir, 'tsconfig.json'),
			projectHandle: 'p',
			compilerOptions: {},
			options,
		});
		return mapper.transform({
			fileName: path.join(consumer_fixture_dir, 'Sample.tsrx'),
			content,
			projectHandle: 'p',
		});
	}

	it('maps every diagnostic of a checker run on the generated code exactly', () => {
		const result = transform({ verificationMappings: true });
		const segments = /** @type {VerificationMapping[]} */ (result.verificationMappings);
		const diagnostics = check({ '/virtual.ts': result.text, '/plain.ts': SAMPLE });
		const plain = diagnostics
			.filter(([file]) => file === '/plain.ts')
			.map(([, start, end, code]) => [start, end, code]);
		const mapped = diagnostics
			.filter(([file]) => file === '/virtual.ts')
			.map(([, start, end, code]) => {
				const range = map_range(
					segments,
					/** @type {number} */ (start),
					/** @type {number} */ (end),
				);
				return range ? [...range, code] : ['unmapped', SAMPLE.length, code];
			});
		expect(plain.length).toBe(16);
		expect(mapped).toEqual(plain);
		// Without the zero-length points, 12 of the 16 would have no mapped end.
		expect(segments.some(([, length]) => length === 0)).toBe(true);
	});

	it('is absent by default and leaves the rest of the result unchanged', () => {
		const default_result = transform();
		expect(default_result).not.toHaveProperty('verificationMappings');
		expect(transform({ verificationMappings: false })).toEqual(default_result);
		const { verificationMappings, ...rest } = transform({ verificationMappings: true });
		expect(verificationMappings?.length).toBeGreaterThan(0);
		expect(JSON.stringify(rest)).toBe(JSON.stringify(default_result));
		// A file that fails to compile gets the export stub and no segments.
		expect(transform({ verificationMappings: true }, '{{{').verificationMappings).toEqual([]);
	});
});

describe('to_verification_mappings', () => {
	const verify = { verification: true, customData: {} };
	const text = 'abcdefghij';

	/**
	 * @param {number[]} source
	 * @param {number[]} generated
	 * @param {number[]} lengths
	 * @param {number[]} [generated_lengths]
	 * @param {import('@tsrx/core/types').CodeMapping['data']} [data]
	 * @returns {import('@tsrx/core/types').CodeMapping}
	 */
	const mapping = (source, generated, lengths, generated_lengths = lengths, data = verify) => ({
		sourceOffsets: source,
		generatedOffsets: generated,
		lengths,
		generatedLengths: generated_lengths,
		data,
	});

	it('keeps every verification index once, in generated order, overlapping or not', () => {
		const mappings = [
			// A container and the token inside it both stay.
			mapping([0], [0], [6]),
			mapping([2], [2], [2]),
			// Points of one mapping: its start and end, with no length.
			mapping([1, 9], [1, 8], [0, 0]),
			// Different lengths on the two sides.
			mapping([6], [7], [3], [2]),
		];
		expect(to_verification_mappings(mappings, text, text)).toEqual([
			[0, 6, 0, 6],
			[1, 0, 1, 0],
			[2, 2, 2, 2],
			[7, 2, 6, 3],
			[8, 0, 9, 0],
		]);
	});

	it('skips mappings without verification, negative lengths and ranges outside a text', () => {
		const mappings = [
			mapping([0], [0], [2], [2], { customData: {} }),
			mapping([0], [0], [-1]),
			mapping([9], [9], [2]),
			mapping([0], [9], [1], [2]),
			mapping([3], [3], [1]),
		];
		expect(to_verification_mappings(mappings, text, text)).toEqual([[3, 1, 3, 1]]);
	});
});
