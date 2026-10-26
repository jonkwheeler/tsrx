import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { servePlatformChangeFixture } from '@tsrx/core/test-harness/platform';
import { tsrxReact } from '../src/index.js';

const fixtures_dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('@tsrx/vite-plugin-react platform flags', () => {
	it('applies a tsconfig platform change without a manual restart', async () => {
		const { before, after } = await servePlatformChangeFixture({
			root: join(fixtures_dir, 'platform-change'),
			plugins: [tsrxReact()],
		});

		expect(before).toEqual({ module: 'web', tsrx: 'web' });
		expect(after).toEqual({ module: 'ios', tsrx: 'ios' });
	}, 60_000);
});
