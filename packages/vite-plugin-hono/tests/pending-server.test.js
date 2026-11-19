import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tsrxHono } from '../src/index.js';

// On the server, a `@pending` body runs only while the `@try` body suspends,
// and a throw in it reaches the nearest `@catch`.
const source = `
import { createContext, use, useContext } from 'hono/jsx';

const Theme = createContext('light');

export const state = { runs: 0 };

function pending_label() {
	state.runs++;
	return 'loading';
}

function boom_label(): string {
	state.runs++;
	throw new Error('pending boom');
}

function Suspender(props) @{
	const value = use(props.promise);
	<p class="resolved">{value}</p>
}

async function AsyncChild(props) @{
	const value = await props.promise;
	<p class="resolved">{value}</p>
}

export function NoSuspend() @{
	@try {
		<p class="ready">{'ready'}</p>
	} @pending {
		const label = pending_label();
		<p class="pending">{label}</p>
	}
}

export function Suspends(props) @{
	@try {
		<Suspender promise={props.promise} />
	} @pending {
		const label = pending_label();
		<p class="pending">{label}</p>
	}
}

export function ThrowingPendingNoSuspend() @{
	@try {
		<p class="ready">{'ready'}</p>
	} @pending {
		const label = boom_label();
		<p class="pending">{label}</p>
	} @catch (error) {
		<p class="caught">{(error as Error).message}</p>
	}
}

export function ThrowingPending(props) @{
	@try {
		<Suspender promise={props.promise} />
	} @pending {
		const label = boom_label();
		<p class="pending">{label}</p>
	} @catch (error) {
		<p class="caught">{(error as Error).message}</p>
	}
}

export function ThrowingPendingAsyncChild(props) @{
	@try {
		<AsyncChild promise={props.promise} />
	} @pending {
		const label = boom_label();
		<p class="pending">{label}</p>
	} @catch (error) {
		<p class="caught">{(error as Error).message}</p>
	}
}

export function ThemedPending(props) @{
	<Theme.Provider value="dark">
		@try {
			<Suspender promise={props.promise} />
		} @pending {
			const theme = useContext(Theme);
			<p class="pending">{'pending sees ' + theme}</p>
		}
	</Theme.Provider>
}

export function OuterCatch(props) @{
	@try {
		<div class="outer">
			@try {
				<Suspender promise={props.promise} />
			} @pending {
				const label = boom_label();
				<p class="pending">{label}</p>
			}
		</div>
	} @catch (error) {
		<p class="outer-caught">{(error as Error).message}</p>
	}
}
`;

/** @type {string} */
let directory;
/** @type {any} */
let mod;
/** @type {any} */
let hono;

beforeAll(async () => {
	const plugin = tsrxHono();
	const context = {
		environment: { moduleGraph: { getModuleById() {}, invalidateModule() {} } },
	};
	directory = await mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), '.tmp-hono-'));
	const output_id = path.join(directory, 'Pending.js');
	const transformed = await plugin.transform.call(
		context,
		source,
		path.join(directory, 'Pending.tsrx'),
	);
	await writeFile(output_id, transformed.code);
	const [module, { jsx }, { renderToReadableStream }, { Hono }] = await Promise.all([
		import(`${pathToFileURL(output_id).href}?test=${Date.now()}`),
		import('hono/jsx'),
		import('hono/jsx/streaming'),
		import('hono'),
	]);
	mod = module;
	hono = { jsx, renderToReadableStream, Hono };
});

afterAll(async () => {
	await rm(directory, { recursive: true, force: true });
});

/**
 * @param {string} name
 * @returns {{ promise: Promise<string> }}
 */
function props_for(name) {
	mod.state.runs = 0;
	return { promise: new Promise((resolve) => setTimeout(() => resolve('done'), 5)) };
}

/**
 * Renders `name` with `renderToReadableStream` and drops Hono's inline scripts.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function stream(name) {
	/** @type {unknown[]} */
	const errors = [];
	const body = hono.renderToReadableStream(hono.jsx(mod[name], props_for(name)), (error) => {
		errors.push(error);
	});
	let html = '';
	for await (const chunk of body) html += new TextDecoder().decode(chunk);
	expect(errors).toEqual([]);
	return html.replace(/<script>[\s\S]*?<\/script>/g, '');
}

/**
 * Renders `name` through `c.html`, which waits for suspended content.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function html(name) {
	const app = new hono.Hono();
	app.onError((/** @type {unknown} */ error, /** @type {any} */ c) =>
		c.text(`onError ${String(error)}`, 500),
	);
	app.get('/', (/** @type {any} */ c) => c.html(hono.jsx(mod[name], props_for(name))));
	const response = await app.request('/');
	return `${response.status} ${await response.text()}`;
}

describe('@tsrx/vite-plugin-hono server @pending', () => {
	it('does not run the @pending body when nothing suspends', async () => {
		expect(await stream('NoSuspend')).toBe('<p class="ready">ready</p>');
		expect(mod.state.runs).toBe(0);
		expect(await html('NoSuspend')).toBe('200 <p class="ready">ready</p>');
		expect(mod.state.runs).toBe(0);
	});

	it('runs the @pending body once while the body suspends', async () => {
		const streamed = await stream('Suspends');
		expect(mod.state.runs).toBe(1);
		expect(streamed).toContain('<p class="pending">loading</p>');
		expect(streamed).toContain('<p class="resolved">done</p>');
		expect(await html('Suspends')).toBe('200 <p class="resolved">done</p>');
		expect(mod.state.runs).toBe(1);
	});

	it('renders the body when the @pending body would throw but nothing suspends', async () => {
		expect(await stream('ThrowingPendingNoSuspend')).toContain('<p class="ready">ready</p>');
		expect(mod.state.runs).toBe(0);
		expect(await html('ThrowingPendingNoSuspend')).toBe('200 <p class="ready">ready</p>');
	});

	it.each(['ThrowingPending', 'ThrowingPendingAsyncChild'])(
		'%s: shows the same @try’s @catch when the @pending body throws while suspended',
		async (name) => {
			const streamed = await stream(name);
			expect(mod.state.runs).toBe(1);
			expect(streamed).toContain('<p class="caught">pending boom</p>');
			expect(streamed).not.toContain('class="resolved"');
			expect(await html(name)).toBe('200 <p class="caught">pending boom</p>');
		},
	);

	it('reads context that the same component provides around the @try', async () => {
		expect(await stream('ThemedPending')).toContain('<p class="pending">pending sees dark</p>');
	});

	it('shows an enclosing @catch when the @try has none', async () => {
		const streamed = await stream('OuterCatch');
		expect(streamed).toContain('<p class="outer-caught">pending boom</p>');
		expect(streamed).not.toContain('class="outer"');
		expect(await html('OuterCatch')).toBe('200 <p class="outer-caught">pending boom</p>');
	});
});
