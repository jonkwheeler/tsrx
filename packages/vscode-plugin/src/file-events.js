/**
 * Keeps file events from `node_modules` in the extension host. VS Code's default
 * `files.watcherExclude` watches `node_modules`, so the server's watcher for JSON files
 * sees every package.json an install or a dev server writes there (Vite rewrites
 * `node_modules/.vite/deps` whenever it optimizes dependencies). vscode-languageclient
 * holds file events until none has arrived for 250 ms, so a steady stream of them grows
 * that queue in the extension host without limit. The server ignores these events: an
 * install that changes the TSRX compiler also changes the project's lockfile.
 * @param {import('vscode-languageclient/node').FileEvent} event
 * @param {(event: import('vscode-languageclient/node').FileEvent) => Promise<void>} next
 * @returns {Promise<void>}
 */
export function forward_file_event(event, next) {
	return event.uri.includes('/node_modules/') ? Promise.resolve() : next(event);
}
