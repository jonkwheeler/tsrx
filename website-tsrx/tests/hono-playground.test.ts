import { describe, expect, it } from 'vitest';
import { DEMO_SNIPPETS } from '../src/lib/demo-snippets.ts';
import { routes } from '../src/routes.ts';

const route = routes.find((route) => route.type === 'server' && route.path === '/api/compile');
if (!route || route.type !== 'server') throw new Error('Missing playground compile endpoint');
const compile_handler = route.handler;

async function compile(source: string, target: string) {
	return compile_handler({
		request: new Request('http://localhost/api/compile', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ source, target }),
		}),
	} as Parameters<typeof compile_handler>[0]);
}

for (const target of ['hono', 'hono-dom']) {
	describe(`website playground: ${target}`, () => {
		const snippets = DEMO_SNIPPETS.filter(
			(snippet) => !snippet.targets || snippet.targets.includes(target),
		);

		it.each(snippets)('compiles $label through the API', async ({ source }) => {
			const response = await compile(source, target);
			const result = await response.json();

			expect(result.error).toBeUndefined();
			expect(response.status).toBe(200);
			expect(result.target).toBe(target);
			expect(result.output.code.trim()).not.toBe('');
			expect(typeof result.output.css).toBe('string');
		});

		it('selects the matching runtime for generated error boundaries', async () => {
			const source = DEMO_SNIPPETS.find((snippet) => snippet.value === 'error-boundary')!.source;
			const result = await (await compile(source, target)).json();
			const runtime =
				target === 'hono-dom' ? '@tsrx/hono/dom/error-boundary' : '@tsrx/hono/error-boundary';

			expect(result.output.code).toContain(runtime);
			expect(result.output.code).toContain('fallbackRender');
		});

		it('returns the scoped CSS alongside compiled code', async () => {
			const source = DEMO_SNIPPETS.find((snippet) => snippet.value === 'scoped-styles')!.source;
			const result = await (await compile(source, target)).json();

			expect(result.output.css).toContain('padding: 1.5rem');
			expect(result.output.code).toContain('class=');
		});
	});
}

it('keeps server async components out of the DOM examples and rejects them in DOM mode', async () => {
	const snippet = DEMO_SNIPPETS.find((snippet) => snippet.value === 'hono-server-streaming')!;
	expect(snippet.targets).not.toContain('hono-dom');

	const response = await compile(snippet.source, 'hono-dom');
	expect(response.status).toBe(422);
	expect((await response.json()).error).toMatch(/Hono JSX DOM does not support/);
});

it('rejects unknown targets instead of falling back to another compiler', async () => {
	const response = await compile('<div />', 'unsupported');
	expect(response.status).toBe(400);
	expect((await response.json()).error).toContain('hono-dom');
});
