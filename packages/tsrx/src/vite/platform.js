/** @import * as AST from 'estree' */
/** @import { Platform } from '../../types/index' */

/**
 * Vite support for compile-time platform flags outside `.tsrx` compilation.
 *
 * - Vite reads `define`, which holds the flag constants for ordinary modules,
 *   once per server start. {@link restartOnPlatformChange} restarts the dev
 *   server when a tsconfig change selects a different platform, so neither the
 *   constants nor the `.tsrx` compile options keep the old selection.
 * - Vite only defines the flags once a platform is configured. Without one, a
 *   flag in a module the TSRX compiler never sees would build and then fail
 *   when it runs (`(void 0).web`). {@link findUnconfiguredPlatformFlag} finds
 *   it so the plugin can reject it, as the compiler rejects one in a `.tsrx`
 *   module.
 */

import { TSRX_ERRORS } from '../diagnostics.js';
import { find_platform_flag } from '../transform/platform.js';
import { stripWorkerEntryQuery } from './worker.js';

const ORDINARY_MODULE_PATTERN = /\.[cm]?[jt]sx?$/;
const PLATFORM_NAMESPACE_PATTERN = /\bimport\s*\.\s*meta\s*\.\s*env\s*\.\s*platform\b/;

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

/**
 * Find the first recognized platform flag in an ordinary JavaScript or
 * TypeScript module. Call it only while no platform is configured.
 *
 * @param {string} code
 * @param {string} id
 * @param {(filename: string, code: string) => { program: unknown, errors: readonly unknown[] }} parse
 *   Vite's `parseSync`. A module it cannot parse is left to Vite.
 * @returns {{ message: string, code: string, pos: number } | null}
 */
export function findUnconfiguredPlatformFlag(code, id, parse) {
	const file = stripWorkerEntryQuery(id);
	if (!ORDINARY_MODULE_PATTERN.test(file) || !PLATFORM_NAMESPACE_PATTERN.test(code)) return null;

	const { program, errors } = parse(file, code);
	if (errors.length > 0) return null;

	const flag = find_platform_flag(/** @type {AST.Node} */ (program));
	if (flag === null) return null;
	return {
		message: TSRX_ERRORS.PLATFORM_REQUIRED.message,
		code: TSRX_ERRORS.PLATFORM_REQUIRED.code,
		pos: /** @type {AST.Node & { start: number }} */ (flag).start,
	};
}
