import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tsrxHono } from '../src/index.js';

function setup_plugin(options, config = {}) {
	const hooks = { onResolve: [], onLoad: [] };
	const plugin = tsrxHono(options);
	const build = {
		config: { entrypoints: [], plugins: [], ...config },
		onResolve(hook_options, callback) {
			hooks.onResolve.push({ options: hook_options, callback });
			return build;
		},
		onLoad(hook_options, callback) {
			hooks.onLoad.push({ options: hook_options, callback });
			return build;
		},
	};
	plugin.setup(build);
	hooks.config = build.config;
	return hooks;
}

async function load_tsrx(hooks, file_path) {
	const hook = hooks.onLoad.find(({ options }) => options.namespace === 'file');
	return hook.callback({ path: file_path, namespace: 'file', importer: '', kind: 'entry-point' });
}

describe('@tsrx/bun-plugin-hono', () => {
	it('rejects an invalid mode instead of silently selecting server', () => {
		expect(() => tsrxHono({ mode: /** @type {any} */ ('dmo') })).toThrow(/invalid mode/);
	});

	it('specializes platform flags and defines them for Bun', async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), 'tsrx-bun-plugin-hono-platform-'));
		try {
			const file_path = path.join(dir, 'Platform.tsrx');
			await writeFile(
				file_path,
				`if (import.meta.env.platform.web) {
					const selected_web = 'selected_web';
				} else {
					const selected_native = 'selected_native';
				}`,
			);
			const hooks = setup_plugin({ platform: 'web' }, { target: 'browser' });
			const result = await load_tsrx(hooks, file_path);

			expect(hooks.config.define['import.meta.env.platform.web']).toBe('true');
			expect(hooks.config.define['import.meta.env.platform.ios']).toBe('false');
			expect(result.contents).toContain('selected_web');
			expect(result.contents).not.toContain('selected_native');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('reads the platform from the Bun build tsconfig', async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), 'tsrx-bun-plugin-hono-platform-'));
		try {
			await writeFile(
				path.join(dir, 'tsconfig.json'),
				JSON.stringify({ tsrx: { platform: 'android' } }),
			);
			const file_path = path.join(dir, 'Platform.tsrx');
			await writeFile(
				file_path,
				`if (import.meta.env.platform.android) {
					const selected_android = 'selected_android';
				} else {
					const selected_other = 'selected_other';
				}`,
			);
			const hooks = setup_plugin(undefined, { root: dir, target: 'browser' });
			const result = await load_tsrx(hooks, file_path);

			expect(hooks.config.define['import.meta.env.platform.android']).toBe('true');
			expect(result.contents).toContain('selected_android');
			expect(result.contents).not.toContain('selected_other');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('compiles server files and selects hono/jsx', async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), 'tsrx-bun-plugin-hono-'));
		try {
			const file_path = path.join(dir, 'App.tsrx');
			await writeFile(file_path, `export function App() @{ <div class="app">{'Hello'}</div> }`);
			const hooks = setup_plugin(undefined, { target: 'browser' });
			const result = await load_tsrx(hooks, file_path);
			// Bun's own TSX transform selects the development or production runtime.
			expect(result.loader).toBe('tsx');
			expect(result.contents).toMatch(/^\/\*\* @jsxImportSource hono\/jsx \*\/\n/);
			expect(result.contents).toContain('<div class="app">');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('selects hono/jsx/dom and serves component CSS', async () => {
		const dir = await mkdtemp(path.join(os.tmpdir(), 'tsrx-bun-plugin-hono-dom-'));
		try {
			const file_path = path.join(dir, 'App.tsrx');
			await writeFile(
				file_path,
				`export function App() @{ <><div class="app">{'Hello'}</div><style>.app { color: red; }</style></> }`,
			);
			const hooks = setup_plugin({ mode: 'dom' }, { target: 'browser' });
			const result = await load_tsrx(hooks, file_path);
			const css_id = `${file_path}?tsrx-css&lang.css`;
			const resolved = hooks.onResolve.find(({ options }) => options.filter.test(css_id));
			const css = hooks.onLoad.find(
				({ options }) => options.namespace === resolved.callback({ path: css_id }).namespace,
			);
			const css_result = css.callback({ path: css_id });
			expect(result.contents).toContain(css_id);
			expect(css_result.contents).toContain('color: red;');
			expect(result.contents).toMatch(/^\/\*\* @jsxImportSource hono\/jsx\/dom \*\/\n/);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("does not claim another plugin's virtual CSS module", async () => {
		const hooks = setup_plugin();
		const resolve = hooks.onResolve.find(({ options }) =>
			options.filter.test('/other.css?tsrx-css&lang.css'),
		);

		expect(resolve.callback({ path: '/other.css?tsrx-css&lang.css' })).toBeUndefined();
	});
});
