import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { clone_ast_node } from '../../../packages/tsrx/src/transform/jsx/ast-builders.js';

const MODE = process.argv[2];
const FUNCTION_COUNT = 120;
const STATEMENTS_PER_FUNCTION = 18;
const ITERATIONS = 12;
const ROUNDS = 7;

function location(offset) {
	return {
		start: offset,
		end: offset + 8,
		loc: {
			start: { line: offset + 1, column: 0 },
			end: { line: offset + 1, column: 8 },
		},
	};
}

function identifier(name, offset) {
	return { type: 'Identifier', name, metadata: { path: [], generated: false }, ...location(offset) };
}

function build_program() {
	let offset = 0;
	const body = [];
	for (let function_index = 0; function_index < FUNCTION_COUNT; function_index += 1) {
		const statements = [];
		for (let statement_index = 0; statement_index < STATEMENTS_PER_FUNCTION; statement_index += 1) {
			statements.push({
				type: 'VariableDeclaration',
				kind: 'const',
				declarations: [
					{
						type: 'VariableDeclarator',
						id: identifier(`value_${function_index}_${statement_index}`, offset++),
						init: {
							type: 'BinaryExpression',
							operator: '+',
							left: {
								type: 'MemberExpression',
								object: identifier(`record_${function_index}`, offset++),
								property: identifier(`field_${statement_index}`, offset++),
								computed: false,
								optional: false,
								metadata: { path: [] },
								...location(offset++),
							},
							right: {
								type: 'Literal',
								value: statement_index,
								raw: String(statement_index),
								metadata: { path: [] },
								...location(offset++),
							},
							metadata: { path: [] },
							...location(offset++),
						},
						metadata: { path: [] },
						...location(offset++),
					},
				],
				metadata: { path: [] },
				...location(offset++),
			});
		}
		body.push({
			type: 'FunctionDeclaration',
			id: identifier(`Component_${function_index}`, offset++),
			params: [identifier('props', offset++)],
			generator: false,
			async: false,
			expression: false,
			body: {
				type: 'BlockStatement',
				body: statements,
				metadata: { path: [] },
				...location(offset++),
			},
			metadata: { path: [] },
			...location(offset++),
		});
	}
	return { type: 'Program', sourceType: 'module', body, metadata: { path: [] }, ...location(offset) };
}

function count_objects(value, seen = new Set()) {
	if (!value || typeof value !== 'object' || seen.has(value)) return 0;
	seen.add(value);
	let count = 1;
	for (const child of Object.values(value)) count += count_objects(child, seen);
	return count;
}

function deep_locations_removed(value, seen = new Set()) {
	if (!value || typeof value !== 'object' || seen.has(value)) return true;
	seen.add(value);
	if (!Array.isArray(value) && ('start' in value || 'end' in value || 'loc' in value)) return false;
	return Object.values(value).every((child) => deep_locations_removed(child, seen));
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

function run_mode(with_locations) {
	const ast = build_program();
	for (let index = 0; index < 4; index += 1) clone_ast_node(ast, with_locations);
	const samples = [];
	let checksum = 0;
	for (let round = 0; round < ROUNDS; round += 1) {
		globalThis.gc?.();
		const started_at = performance.now();
		for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
			const clone = clone_ast_node(ast, with_locations);
			checksum += clone.body.length + clone.body[0].body.body.length;
		}
		samples.push((performance.now() - started_at) / ITERATIONS);
	}
	return { median_ms: median(samples), samples, checksum };
}

if (MODE === '--with-locations' || MODE === '--without-locations') {
	process.stdout.write(JSON.stringify(run_mode(MODE === '--with-locations')));
	process.exit(0);
}

function measure_in_child(mode) {
	const result = spawnSync(
		process.execPath,
		[...process.execArgv, fileURLToPath(import.meta.url), mode],
		{ encoding: 'utf8', timeout: 90_000 },
	);
	if (result.status !== 0) {
		throw new Error(result.stderr || `measurement child ${mode} exited ${result.status}`);
	}
	return JSON.parse(result.stdout);
}

const source = build_program();
const source_snapshot = JSON.stringify(source);
const with_locations_clone = clone_ast_node(source, true);
const without_locations_clone = clone_ast_node(source, false);
const semantic_ok =
	with_locations_clone !== source &&
	with_locations_clone.body !== source.body &&
	with_locations_clone.body[0] !== source.body[0] &&
	JSON.stringify(with_locations_clone) === source_snapshot &&
	JSON.stringify(source) === source_snapshot;

const without_locations = measure_in_child('--without-locations');
const with_locations = measure_in_child('--with-locations');

process.stdout.write(
	JSON.stringify({
		clone_without_locations_ms: without_locations.median_ms,
		clone_with_locations_ms: with_locations.median_ms,
		semantic_ok: semantic_ok ? 1 : 0,
		locations_removed: deep_locations_removed(without_locations_clone) ? 1 : 0,
		ast_objects: count_objects(source),
	}),
);
