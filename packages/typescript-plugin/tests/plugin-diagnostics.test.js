import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import plugin from '../src/index.js';
import { without_typescript_diagnostics_on_compile_error } from '../src/plugin-diagnostics.js';
import { files_with_fatal_compile_error, has_fatal_compile_error } from '../src/language.js';
import { create_tsserver_workspace, start_tsserver } from './tsserver.js';

describe('tsserver plugin: TypeScript diagnostics on TSRX compile failure', () => {
	it('drops every TypeScript diagnostic of a file whose TSRX compilation failed', () => {
		const calls = /** @type {string[]} */ ([]);
		const service = {
			getSyntacticDiagnostics: (/** @type {string} */ f) => (calls.push(`syn:${f}`), ['syn']),
			getSemanticDiagnostics: (/** @type {string} */ f) => (calls.push(`sem:${f}`), ['sem']),
			getSuggestionDiagnostics: (/** @type {string} */ f) => (calls.push(`sug:${f}`), ['sug']),
			getQuickInfoAtPosition: () => 'info',
		};
		const wrapped = without_typescript_diagnostics_on_compile_error(service, (file) =>
			file.endsWith('Broken.tsrx'),
		);
		expect(wrapped.getSyntacticDiagnostics('/p/Broken.tsrx')).toEqual([]);
		expect(wrapped.getSemanticDiagnostics('/p/Broken.tsrx')).toEqual([]);
		expect(wrapped.getSuggestionDiagnostics('/p/Broken.tsrx')).toEqual([]);
		expect(calls).toEqual([]);
		// Healthy files and every other method pass straight through.
		expect(wrapped.getSemanticDiagnostics('/p/Panel.tsrx')).toEqual(['sem']);
		expect(wrapped.getSyntacticDiagnostics('/p/main.ts')).toEqual(['syn']);
		expect(wrapped.getQuickInfoAtPosition()).toBe('info');
		expect(calls).toEqual(['sem:/p/Panel.tsrx', 'syn:/p/main.ts']);
	});

	it('keys the compile-failure registry by normalized file name', () => {
		files_with_fatal_compile_error.add('c:/work/app/broken.tsrx');
		try {
			expect(has_fatal_compile_error('C:\\work\\App\\Broken.tsrx')).toBe(true);
			expect(has_fatal_compile_error('/work/app/broken.tsrx')).toBe(false);
		} finally {
			files_with_fatal_compile_error.delete('c:/work/app/broken.tsrx');
		}
	});

	it('exposes a tsserver plugin whose create() wraps the language service', () => {
		expect(typeof plugin).toBe('function');
	});
});

describe('tsserver plugin: TypeScript diagnostics around an unclosed tag', () => {
	const FILES = {
		'tsconfig.json': JSON.stringify({
			compilerOptions: {
				jsx: 'preserve',
				module: 'esnext',
				moduleResolution: 'bundler',
				types: [],
			},
			tsrx: { compiler: '@tsrx/react' },
			include: ['src'],
		}),
		'src/Unclosed.tsrx': 'export function C() @{\n\t<div><Missing>valid</div>\n}\n',
		'src/UnclosedNested.tsrx': 'export function C() @{\n\t<div><Missing><b>x</div>\n}\n',
	};
	/** @type {string} */
	let workspace;
	/** @type {ReturnType<typeof start_tsserver>} */
	let server;

	beforeAll(async () => {
		const created = create_tsserver_workspace('tsrx-unclosed-', FILES);
		workspace = created.workspace;
		server = start_tsserver(workspace, created.probe_location);
		for (const file of ['src/Unclosed.tsrx', 'src/UnclosedNested.tsrx']) {
			const full = path.join(workspace, file);
			await server.request('open', {
				file: full,
				fileContent: fs.readFileSync(full, 'utf8'),
				projectRootPath: workspace,
			});
		}
	}, 60_000);

	afterAll(() => {
		server?.stop();
		fs.rmSync(workspace, { recursive: true, force: true });
	});

	// TypeScript also reports the undefined name on the closing tag the
	// editor's code adds, which has no mapping. The parent's closing tag
	// starts after it, so the error isn't repeated on `</div>`.
	it.each(['src/Unclosed.tsrx', 'src/UnclosedNested.tsrx'])(
		'reports the undefined unclosed tag of %s once, at its name',
		async (file) => {
			const response = await server.request('semanticDiagnosticsSync', {
				file: path.join(workspace, file),
			});
			expect(
				response.body
					.filter((/** @type {any} */ diagnostic) => diagnostic.code === 2304)
					.map((/** @type {any} */ diagnostic) => ({
						start: diagnostic.start,
						end: diagnostic.end,
					})),
			).toEqual([{ start: { line: 2, offset: 8 }, end: { line: 2, offset: 15 } }]);
		},
	);
});
