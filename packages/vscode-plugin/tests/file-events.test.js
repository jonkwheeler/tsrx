import { describe, expect, it, vi } from 'vitest';
import { forward_file_event } from '../src/file-events.js';

const CHANGED = 2;

/** @param {string} uri */
async function forwarded(uri) {
	const next = vi.fn(async () => {});
	await forward_file_event({ uri, type: CHANGED }, next);
	return next.mock.calls.length > 0;
}

describe('file events sent to the TSRX language server', () => {
	it('keeps events from node_modules in the extension host', async () => {
		expect(await forwarded('file:///workspace/node_modules/.vite/deps/package.json')).toBe(false);
		expect(await forwarded('file:///c%3A/workspace/apps/web/node_modules/react/package.json')).toBe(
			false,
		);
	});

	it('forwards project files, configs and lockfiles', async () => {
		expect(await forwarded('file:///workspace/package.json')).toBe(true);
		expect(await forwarded('file:///workspace/pnpm-lock.yaml')).toBe(true);
		expect(await forwarded('file:///workspace/apps/web/tsconfig.json')).toBe(true);
		expect(await forwarded('file:///workspace/apps/web/src/App.tsrx')).toBe(true);
	});
});
