// pnpm exec node scripts/bench-merge-refs.js [baseline revision] [pairs] [workload] [--control]
// --control compares the baseline with itself to estimate measurement noise.
// Fresh processes, alternating A/B order, median CPU ns per mount + cleanup.
// Each batch retains 64 cleanups until all nodes have mounted, so cleanup
// allocations escape the mount call. These are helper microbenchmarks, not
// application rendering benchmarks.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const script = fileURLToPath(import.meta.url);
const root = dirname(dirname(script));
const workloads = [
	'current',
	'value',
	'callbacks',
	'cleanup-callbacks',
	'mixed',
	'mixed-arity',
	'spread',
	'three-current',
	'three-callbacks',
	'create-current',
	'create-callbacks',
];

if (process.argv[2] === '--worker') {
	const { mergeRefs, merge_ref_props } = await import(process.argv[3]);
	const workload = process.argv[4];
	const batch_size = 64;
	const iterations = 300_032;
	const node = { nodeType: 1, nodeName: 'DIV' };
	const slots = [];
	function ref(kind) {
		const slot = { current: null };
		slots.push(slot);
		if (kind === 'current') return slot;
		if (kind === 'value') {
			const value_slot = { value: null };
			slots.push(value_slot);
			return value_slot;
		}
		if (kind === 'cleanup') {
			return (value) => {
				slot.current = value;
				return () => {
					slot.current = null;
				};
			};
		}
		return (value) => {
			slot.current = value;
		};
	}
	const refs = Array.from({ length: batch_size }, (_, i) => {
		switch (workload) {
			case 'current':
			case 'create-current':
				return [ref('current'), ref('current')];
			case 'value':
				return [ref('value'), ref('value')];
			case 'callbacks':
			case 'create-callbacks':
				return [ref('callback'), ref('callback')];
			case 'cleanup-callbacks':
				return [ref('cleanup'), ref('cleanup')];
			case 'spread':
				// The compiler merges normalized spread refs with an explicit ref.
				return [merge_ref_props(ref('current'), ref('callback')), ref('callback')];
			case 'three-current':
				return [ref('current'), ref('current'), ref('current')];
			case 'three-callbacks':
				return [ref('callback'), ref('callback'), ref('callback')];
			case 'mixed': {
				const kinds = ['current', 'value', 'callback', 'cleanup'];
				return [ref(kinds[i % 4]), ref(kinds[Math.floor(i / 4) % 4])];
			}
			case 'mixed-arity': {
				const kinds = ['current', 'value', 'callback', 'cleanup'];
				return Array.from({ length: (i % 4) + 1 }, (_, j) =>
					ref(kinds[(Math.floor(i / 4) + j) % 4]),
				);
			}
			default:
				throw new Error(`Unknown workload: ${workload}`);
		}
	});
	const merged = refs.map((values) => mergeRefs(...values));
	const cleanups = Array(batch_size);
	const create = workload.startsWith('create-');
	function run() {
		for (let n = 0; n < iterations; n += batch_size) {
			for (let i = 0; i < batch_size; i++) {
				cleanups[i] = create ? mergeRefs(refs[i][0], refs[i][1])(node) : merged[i](node);
			}
			for (let i = 0; i < batch_size; i++) cleanups[i]();
		}
	}
	for (let i = 0; i < 4; i++) run();
	const samples = [];
	for (let i = 0; i < 7; i++) {
		const start = process.cpuUsage();
		run();
		const elapsed = process.cpuUsage(start);
		samples.push(((elapsed.user + elapsed.system) * 1_000) / iterations);
	}
	if (slots.some((slot) => (slot.current ?? slot.value) != null)) {
		throw new Error('Ref was not cleaned up');
	}
	console.log(JSON.stringify({ ns: median(samples), samples }));
} else {
	const control = process.argv.includes('--control');
	const args = process.argv.slice(2).filter((arg) => arg !== '--control');
	const revision = args[0] ?? 'origin/main';
	const pairs = Number(args[1] ?? 9);
	if (!Number.isInteger(pairs) || pairs < 1) throw new Error('pairs must be a positive integer');
	const selected = args[2] ? [args[2]] : workloads;
	const runtime = 'packages/tsrx-runtime/src/ref.js';
	const baseline_commit = execFileSync('git', ['rev-parse', revision], {
		cwd: root,
		encoding: 'utf8',
	}).trim();
	const directory = mkdtempSync(join(tmpdir(), 'tsrx-merge-refs-'));
	try {
		const sources = {
			baseline: execFileSync('git', ['show', `${baseline_commit}:${runtime}`], {
				cwd: root,
				encoding: 'utf8',
			}),
			candidate: readFileSync(join(root, runtime), 'utf8'),
		};
		if (control) sources.candidate = sources.baseline;
		const helpers = pathToFileURL(join(root, 'packages/tsrx-runtime/src/language-helpers.js')).href;
		for (const [name, source] of Object.entries(sources)) {
			writeFileSync(
				join(directory, `${name}.mjs`),
				source.replace("'@tsrx/runtime/language-helpers'", JSON.stringify(helpers)),
			);
		}
		console.log(
			JSON.stringify({
				node: process.version,
				baseline: baseline_commit,
				control,
				pairs,
				reps: 7,
				iterations: 300_032,
				batch: 64,
			}),
		);
		for (const workload of selected) {
			const measurements = [];
			for (let pair = 0; pair < pairs; pair++) {
				const result = {};
				for (const name of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
					result[name] = JSON.parse(
						execFileSync(
							process.execPath,
							[script, '--worker', pathToFileURL(join(directory, `${name}.mjs`)).href, workload],
							{ encoding: 'utf8' },
						),
					).ns;
				}
				measurements.push(result);
			}
			const reductions = measurements.map(
				({ baseline, candidate }) => 100 * (1 - candidate / baseline),
			);
			const reduction = median(reductions);
			console.log(
				JSON.stringify({
					workload,
					baseline_ns: median(measurements.map((m) => m.baseline)),
					candidate_ns: median(measurements.map((m) => m.candidate)),
					reduction_percent: reduction,
					mad_percent: median(reductions.map((value) => Math.abs(value - reduction))),
					positive_pairs: reductions.filter((value) => value > 0).length,
					measurements,
				}),
			);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
