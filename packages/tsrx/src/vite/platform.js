/** @import { Platform } from '../../types/index' */

/**
 * Vite support for compile-time platform flags outside `.tsrx` compilation.
 *
 * - Vite reads `define`, which holds the flag constants for ordinary modules,
 *   once per server start. {@link restartOnPlatformChange} restarts the dev
 *   server when a tsconfig change selects a different platform, so neither the
 *   constants nor the `.tsrx` compile options keep the old selection.
 */

/**
 * Re-resolve the platform whenever a `.json` file changes (tsconfig files and
 * their `extends` targets) and restart the server when the selection differs
 * from the one it started with. A configuration that no longer resolves also
 * restarts it, so Vite reports the error.
 *
 * @param {{
 *   watcher: { on(event: 'change' | 'add' | 'unlink', listener: (file: string) => void): unknown },
 *   restart(): Promise<void>,
 * }} server
 * @param {() => Platform | undefined} current the platform the plugin uses now
 * @param {() => Platform | undefined} resolve resolves the platform from tsconfig again
 */
export function restartOnPlatformChange(server, current, resolve) {
	/** @param {string} file */
	function on_change(file) {
		if (!file.endsWith('.json')) return;
		let changed;
		try {
			changed = resolve() !== current();
		} catch {
			changed = true;
		}
		if (changed) void server.restart();
	}

	server.watcher.on('change', on_change);
	server.watcher.on('add', on_change);
	server.watcher.on('unlink', on_change);
}
