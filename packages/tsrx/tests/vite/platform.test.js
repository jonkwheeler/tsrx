import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { parseSync } from 'vite';
import { DIAGNOSTIC_CODES } from '../../src/diagnostics.js';
import { findUnconfiguredPlatformFlag, restartOnPlatformChange } from '../../src/vite/platform.js';

describe('findUnconfiguredPlatformFlag', () => {
	it('finds a recognized flag in ordinary modules', () => {
		const code = "export const answer = 1 > 0 && import.meta.env.platform.web ? 'web' : 'native';";
		for (const id of [
			'/app/helper.ts',
			'/app/helper.tsx',
			'/app/helper.mjs',
			'/app/worker.ts?worker_file&type=module',
		]) {
			expect(findUnconfiguredPlatformFlag(code, id, parseSync)).toEqual({
				message: expect.stringContaining('Platform flag usage requires a configured TSRX platform'),
				code: DIAGNOSTIC_CODES.PLATFORM_REQUIRED,
				pos: code.indexOf('import.meta'),
			});
		}
	});

	it('ignores flag text that is not a recognized flag', () => {
		for (const code of [
			'export const docs = "import.meta.env.platform.web";',
			'// import.meta.env.platform.web\nexport {};',
			'export const all = import.meta.env.platform;',
			'export const web = import.meta.env.platform?.web;',
			"export const web = import.meta.env.platform['web'];",
			'export const broken = import.meta.env.platform.web +;',
		]) {
			expect(findUnconfiguredPlatformFlag(code, '/app/helper.ts', parseSync)).toBeNull();
		}
	});

	it('parses TypeScript and JSX by extension', () => {
		const ts = 'export const web = <boolean>import.meta.env.platform.web;';
		const tsx = 'export const web = <b>{import.meta.env.platform.web}</b>;';
		expect(findUnconfiguredPlatformFlag(ts, '/app/helper.ts', parseSync)?.pos).toBe(28);
		expect(findUnconfiguredPlatformFlag(tsx, '/app/View.tsx', parseSync)?.pos).toBe(23);
	});

	it('leaves .tsrx modules, assets and other queries alone', () => {
		const code = 'export const web = import.meta.env.platform.web;';
		for (const id of ['/app/App.tsrx', '/app/helper.ts?raw', '/app/style.css']) {
			expect(findUnconfiguredPlatformFlag(code, id, parseSync)).toBeNull();
		}
	});
});

describe('restartOnPlatformChange', () => {
	/** @param {() => 'web' | 'ios' | undefined} resolve */
	function watch(resolve) {
		const watcher = new EventEmitter();
		let restarts = 0;
		restartOnPlatformChange(
			{
				watcher,
				restart: async () => {
					restarts++;
				},
			},
			() => 'web',
			resolve,
		);
		return { watcher, restarts: () => restarts };
	}

	it('restarts when a json change selects another platform', () => {
		let platform = /** @type {'web' | 'ios'} */ ('web');
		const { watcher, restarts } = watch(() => platform);

		watcher.emit('change', '/app/tsconfig.json');
		expect(restarts()).toBe(0);

		platform = 'ios';
		watcher.emit('change', '/app/src/App.tsrx');
		expect(restarts()).toBe(0);
		watcher.emit('change', '/app/tsconfig.base.json');
		expect(restarts()).toBe(1);
		watcher.emit('unlink', '/app/tsconfig.app.json');
		expect(restarts()).toBe(2);
	});

	it('restarts when the configuration no longer resolves', () => {
		const { watcher, restarts } = watch(() => {
			throw new TypeError('Invalid TSRX platform');
		});

		watcher.emit('add', '/app/tsconfig.json');
		expect(restarts()).toBe(1);
	});
});
