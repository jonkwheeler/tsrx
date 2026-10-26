import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const RESTART_TIMEOUT_MS = 10_000;

/**
 * The same platform selection in an ordinary module, which Vite's `define`
 * specializes, and in a `.tsrx` module, which the TSRX compiler specializes.
 */
const SELECTION = `export const selected = (() => {
	if (import.meta.env.platform.web) {
		return 'web';
	} else {
		return 'ios';
	}
})();
`;

/**
 * @typedef {{ module: string, tsrx: string }} PlatformSelection
 */

/**
 * Serve a project whose tsconfig selects `web`, switch it to `ios`, and report
 * what an ordinary module and a `.tsrx` module select before and after the
 * dev server handled the change.
 *
 * As with the other fixtures, the files are written on the fly and removed
 * afterwards, and `root` has to sit inside the package under test so imports
 * resolve against its `node_modules`.
 *
 * @param {{ root: string, plugins: import('vite').PluginOption[] }} options
 * @returns {Promise<{ before: PlatformSelection, after: PlatformSelection }>}
 */
export async function servePlatformChangeFixture({ root, plugins }) {
	const cache_dir = mkdtempSync(join(tmpdir(), 'tsrx-platform-'));
	const tsconfig = join(root, 'tsconfig.json');
	/** @type {import('vite').ViteDevServer | undefined} */
	let server;

	mkdirSync(root, { recursive: true });
	writeFileSync(tsconfig, JSON.stringify({ tsrx: { platform: 'web' } }));
	writeFileSync(join(root, 'selection.ts'), SELECTION);
	writeFileSync(join(root, 'selection.tsrx'), SELECTION);

	try {
		server = await createServer({
			root,
			configFile: false,
			cacheDir: cache_dir,
			logLevel: 'silent',
			plugins,
			optimizeDeps: { noDiscovery: true, include: [] },
			server: { middlewareMode: true },
		});
		const before = await load_selection(server);

		const dev_server = server;
		const restarted = new Promise((resolve) => {
			const restart = dev_server.restart.bind(dev_server);
			dev_server.restart = (force_optimize) => {
				const restarting = restart(force_optimize);
				restarting.then(resolve);
				return restarting;
			};
		});
		writeFileSync(tsconfig, JSON.stringify({ tsrx: { platform: 'ios' } }));
		// Report the change rather than wait on the file watcher.
		server.watcher.emit('change', tsconfig);
		await Promise.race([
			restarted,
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error('The dev server did not restart')),
					RESTART_TIMEOUT_MS,
				).unref(),
			),
		]);

		return { before, after: await load_selection(server) };
	} finally {
		await server?.close();
		rmSync(cache_dir, { recursive: true, force: true });
		rmSync(root, { recursive: true, force: true });
	}
}

/**
 * @param {import('vite').ViteDevServer} server
 * @returns {Promise<PlatformSelection>}
 */
async function load_selection(server) {
	const [module, tsrx] = await Promise.all([
		server.ssrLoadModule('/selection.ts'),
		server.ssrLoadModule('/selection.tsrx'),
	]);
	return { module: module.selected, tsrx: tsrx.selected };
}
