import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tsrxHono } from '../src/index.js';

test.each(['server', 'dom'] as const)('builds %s JavaScript and CSS with Bun', async (mode) => {
	const dir = await mkdtemp(join(import.meta.dir, '.native-'));
	try {
		const entry = join(dir, 'App.tsrx');
		await writeFile(
			entry,
			'export function App() @{ <><style>p { color: red; }</style><p>{"hello"}</p></> }',
		);
		const result = await Bun.build({
			entrypoints: [entry],
			target: 'browser',
			external: ['hono/*', '@tsrx/*'],
			plugins: [tsrxHono({ mode })],
		});
		expect(result.success).toBe(true);
		const js = await result.outputs.find((output) => output.path.endsWith('.js'))!.text();
		const css = await result.outputs.find((output) => output.path.endsWith('.css'))!.text();
		expect(js).toMatch(
			mode === 'dom' ? /hono\/jsx\/dom\/jsx-(?:dev-)?runtime/ : /hono\/jsx\/jsx-(?:dev-)?runtime/,
		);
		expect(js).not.toContain('react/jsx-runtime');
		expect(css).toContain('red');
		if (mode === 'server') {
			const output = join(dir, 'App.js');
			await writeFile(output, js);
			const { App } = await import(output);
			expect(await App().toString()).toMatch(/<p class="tsrx-[^"]+">hello<\/p>/);
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test('selects the production JSX runtime for production builds', async () => {
	const dir = await mkdtemp(join(import.meta.dir, '.native-'));
	try {
		const entry = join(dir, 'App.tsrx');
		await writeFile(entry, 'export function App() @{ <p>{"hello"}</p> }');
		const result = await Bun.build({
			entrypoints: [entry],
			target: 'browser',
			external: ['hono/*', '@tsrx/*'],
			define: { 'process.env.NODE_ENV': '"production"' },
			plugins: [tsrxHono()],
		});
		expect(result.success).toBe(true);
		const js = await result.outputs[0].text();
		expect(js).toContain('hono/jsx/jsx-runtime');
		expect(js).not.toContain('jsx-dev-runtime');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
