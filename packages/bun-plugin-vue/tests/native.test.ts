import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A `bun:test` preload registers the plugin with Bun.plugin(), which requires
// an object from every onLoad hook, including for modules it leaves alone.
test('works as a bun:test preload', async () => {
	const dir = await mkdtemp(join(import.meta.dir, '.native-'));
	try {
		const files = {
			'preload.mjs': `import { tsrxVue } from ${JSON.stringify(join(import.meta.dir, '../src/index.js'))};\nBun.plugin(tsrxVue());\n`,
			'helper.js': 'export const answer = 42;\n',
			'typed.ts': 'export const double = (value: number): number => value * 2;\n',
			'Answer.tsrx':
				"import { answer } from './helper.js';\nimport { double } from './typed.ts';\nexport const doubled = double(answer);\n",
			'plain.test.js': `import { expect, test } from 'bun:test';\nimport { answer } from './helper.js';\ntest('imports an ordinary module', () => expect(answer).toBe(42));\n`,
			'tsrx.test.js': `import { expect, test } from 'bun:test';\nimport { doubled } from './Answer.tsrx';\ntest('imports a .tsrx module', () => expect(doubled).toBe(84));\n`,
		};
		for (const [name, contents] of Object.entries(files)) {
			await writeFile(join(dir, name), contents);
		}
		const child = Bun.spawnSync({
			cmd: [
				process.execPath,
				'test',
				'--preload',
				'./preload.mjs',
				'./plain.test.js',
				'./tsrx.test.js',
			],
			cwd: dir,
		});
		expect(child.stderr.toString()).toContain(' 2 pass');
		expect(child.exitCode).toBe(0);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

// Bun.plugin() registration calls only the first onLoad hook whose filter
// matches, so instances that split the source files have to hand them on.
test('splits the source files between two instances in a bun:test preload', async () => {
	const dir = await mkdtemp(join(import.meta.dir, '.native-'));
	try {
		const files = {
			'preload.mjs': `import { tsrxVue } from ${JSON.stringify(join(import.meta.dir, '../src/index.js'))};
Bun.plugin(tsrxVue({ exclude: [/Second\\.tsrx$/, /Asset\\.tsrx$/] }));
Bun.plugin(tsrxVue({ include: /Second\\.tsrx$/ }));
`,
			'First.tsrx': "export const name: string = 'first';\n",
			'Second.tsrx': "export const name: string = 'second';\n",
			'Asset.tsrx': 'export const unused = true;\n',
			'split.test.js': `import { expect, test } from 'bun:test';
import { name as first } from './First.tsrx';
import { name as second } from './Second.tsrx';
import asset from './Asset.tsrx';
test('loads both and the left-out file as Bun does', () => {
	expect([first, second]).toEqual(['first', 'second']);
	expect(asset).toEndWith('/Asset.tsrx');
});
`,
		};
		for (const [name, contents] of Object.entries(files)) {
			await writeFile(join(dir, name), contents);
		}
		const child = Bun.spawnSync({
			cmd: [process.execPath, 'test', '--preload', './preload.mjs', './split.test.js'],
			cwd: dir,
		});
		expect(child.stderr.toString()).toContain(' 1 pass');
		expect(child.exitCode).toBe(0);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
