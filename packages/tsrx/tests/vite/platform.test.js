import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { restartOnPlatformChange } from '../../src/vite/platform.js';

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
