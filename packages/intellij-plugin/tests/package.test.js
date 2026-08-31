import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { synchronizeIntellijPluginVersions } from '../../../scripts/sync-intellij-plugin-version.js';
import { createVerificationMatrix } from '../scripts/verification-matrix.mjs';

const test_dir = dirname(fileURLToPath(import.meta.url));
const repository_dir = resolve(test_dir, '../../..');
const temporary_dirs = [];

afterEach(() => {
	for (const directory of temporary_dirs.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe('@tsrx/intellij-plugin release contract', () => {
	it('versions the private package and keeps Gradle metadata synchronized', () => {
		const package_json = read_json(
			resolve(repository_dir, 'packages/intellij-plugin/package.json'),
		);
		const language_server = read_json(
			resolve(repository_dir, 'packages/language-server/package.json'),
		);
		const changesets = read_json(resolve(repository_dir, '.changeset/config.json'));
		const gradle_properties = read_properties(
			readFileSync(resolve(repository_dir, 'packages/intellij-plugin/gradle.properties'), 'utf8'),
		);

		expect(package_json.private).toBe(true);
		expect(changesets.ignore).not.toContain('@tsrx/intellij-plugin');
		expect(changesets.privatePackages).toEqual({ version: true, tag: false });
		expect(gradle_properties.pluginVersion).toBe(package_json.version);
		expect(gradle_properties.tsrxLspVersion).toBe(language_server.version);
		expect(() =>
			synchronizeIntellijPluginVersions({ rootDir: repository_dir, check: true }),
		).not.toThrow();
	});

	it('updates only the two owned Gradle properties and is idempotent', () => {
		const fixture = create_fixture({
			pluginVersion: '1.2.3',
			languageServerVersion: '4.5.6',
			gradleProperties: [
				'org.gradle.caching=true',
				'pluginVersion=0.0.1',
				'tsrxLspVersion=0.0.2',
				'customProperty=preserved',
				'',
			].join('\n'),
		});

		synchronizeIntellijPluginVersions({ rootDir: fixture });
		const first_pass = readFileSync(
			resolve(fixture, 'packages/intellij-plugin/gradle.properties'),
			'utf8',
		);
		synchronizeIntellijPluginVersions({ rootDir: fixture });
		const second_pass = readFileSync(
			resolve(fixture, 'packages/intellij-plugin/gradle.properties'),
			'utf8',
		);

		expect(first_pass).toContain('pluginVersion=1.2.3');
		expect(first_pass).toContain('tsrxLspVersion=4.5.6');
		expect(first_pass).toContain('customProperty=preserved');
		expect(second_pass).toBe(first_pass);
	});

	it('reports drift in check mode without rewriting files', () => {
		const fixture = create_fixture({
			pluginVersion: '1.2.3',
			languageServerVersion: '4.5.6',
			gradleProperties: 'pluginVersion=0.0.1\ntsrxLspVersion=0.0.2\n',
		});
		const properties_path = resolve(fixture, 'packages/intellij-plugin/gradle.properties');
		const before = readFileSync(properties_path, 'utf8');

		expect(() => synchronizeIntellijPluginVersions({ rootDir: fixture, check: true })).toThrow(
			/out of sync.*pluginVersion.*tsrxLspVersion/is,
		);
		expect(readFileSync(properties_path, 'utf8')).toBe(before);
	});

	it.each([
		['missing', 'tsrxLspVersion=4.5.6\n', /pluginVersion.*exactly once/i],
		[
			'duplicate',
			'pluginVersion=1.2.3\npluginVersion=1.2.3\ntsrxLspVersion=4.5.6\n',
			/pluginVersion.*exactly once/i,
		],
		['malformed', 'pluginVersion =1.2.3\ntsrxLspVersion=4.5.6\n', /pluginVersion.*exactly once/i],
	])('rejects a %s owned Gradle property', (_name, gradleProperties, expected) => {
		const fixture = create_fixture({
			pluginVersion: '1.2.3',
			languageServerVersion: '4.5.6',
			gradleProperties,
		});

		expect(() => synchronizeIntellijPluginVersions({ rootDir: fixture })).toThrow(expected);
	});

	it('covers every advertised product plus minimum WebStorm and IntelliJ IDEA anchors', () => {
		const properties = readFileSync(
			resolve(repository_dir, 'packages/intellij-plugin/gradle.properties'),
			'utf8',
		);
		const matrix = createVerificationMatrix(properties).include;
		const advertised = [
			'WebStorm',
			'IntellijIdeaUltimate',
			'IntellijIdeaCommunity',
			'PhpStorm',
			'PyCharm',
			'DataSpell',
			'RubyMine',
			'CLion',
			'DataGrip',
			'GoLand',
			'Rider',
			'RustRover',
		];

		expect(
			matrix.filter(({ channel }) => channel === 'current').map(({ productType }) => productType),
		).toEqual(advertised);
		expect(matrix.filter(({ channel }) => channel === 'minimum')).toEqual([
			expect.objectContaining({ productType: 'WebStorm', productVersion: '2025.2' }),
			expect.objectContaining({
				productType: 'IntellijIdeaUltimate',
				productVersion: '2025.2',
			}),
		]);
	});

	it('keeps the dedicated workflow scoped, credential-free, and fully gated', () => {
		const workflow = readFileSync(
			resolve(repository_dir, '.github/workflows/intellij-plugin.yml'),
			'utf8',
		);

		for (const required of [
			'packages/intellij-plugin/**',
			'grammars/textmate/**',
			'scripts/sync-intellij-plugin-version.js',
			'packages/intellij-plugin/gradlew -p packages/intellij-plugin test',
			'verifyPluginProjectConfiguration',
			'buildPlugin',
			'verifyPluginStructure',
			'verifyPlugin',
		]) {
			expect(workflow).toContain(required);
		}
		expect(workflow).not.toMatch(/CERTIFICATE_CHAIN|PRIVATE_KEY|PUBLISH_TOKEN|secrets\./);
	});

	it('ignores only the absent optional LSP package in syntax-only IDEs', () => {
		const ignored = readFileSync(
			resolve(repository_dir, 'packages/intellij-plugin/plugin-verifier-ignored-problems.txt'),
			'utf8',
		)
			.trim()
			.split(/\r?\n/);

		expect(ignored).toEqual([
			"dev.tsrx.intellij_plugin::Package 'com\\.intellij\\.platform\\.lsp' is not found.*",
		]);
	});
});

function create_fixture({ pluginVersion, languageServerVersion, gradleProperties }) {
	const root = mkdtempSync(resolve(tmpdir(), 'tsrx-intellij-version-'));
	temporary_dirs.push(root);
	mkdirSync(resolve(root, 'packages/intellij-plugin'), { recursive: true });
	mkdirSync(resolve(root, 'packages/language-server'), { recursive: true });
	writeFileSync(
		resolve(root, 'packages/intellij-plugin/package.json'),
		JSON.stringify({ name: '@tsrx/intellij-plugin', version: pluginVersion }),
	);
	writeFileSync(
		resolve(root, 'packages/language-server/package.json'),
		JSON.stringify({ name: '@tsrx/language-server', version: languageServerVersion }),
	);
	writeFileSync(resolve(root, 'packages/intellij-plugin/gradle.properties'), gradleProperties);
	return root;
}

function read_json(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function read_properties(content) {
	return Object.fromEntries(
		content
			.split(/\r?\n/)
			.filter((line) => line && !line.startsWith('#'))
			.map((line) => line.split('=', 2)),
	);
}
