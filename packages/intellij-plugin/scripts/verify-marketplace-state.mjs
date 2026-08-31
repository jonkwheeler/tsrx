import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script_path = fileURLToPath(import.meta.url);
const plugin_id = 'dev.tsrx.intellij_plugin';
const endpoint = `https://plugins.jetbrains.com/plugins/list?pluginId=${plugin_id}`;

export async function verifyMarketplaceState(mode, request = fetch) {
	if (mode !== 'stage' && mode !== 'publish') {
		throw new Error(`Expected Marketplace mode stage or publish, received ${mode}`);
	}
	const response = await request(endpoint);
	if (!response.ok) {
		throw new Error(`Marketplace plugin lookup failed with HTTP ${response.status}`);
	}
	const xml = await response.text();
	validateMarketplaceState(mode, xml);
	process.stdout.write(
		mode === 'stage'
			? `Confirmed that ${plugin_id} has no public Marketplace listing.\n`
			: `Confirmed that ${plugin_id} has a public Marketplace listing.\n`,
	);
}

export function validateMarketplaceState(mode, xml) {
	const isEmpty = /<plugin-repository\s*\/>/.test(xml);
	const containsPlugin =
		xml.includes('<idea-plugin') &&
		new RegExp(`<id>\\s*${escapeRegex(plugin_id)}\\s*</id>`).test(xml);

	if (mode === 'stage' && !isEmpty) {
		throw new Error(
			`${plugin_id} already has a public listing; use publish mode after ownership review`,
		);
	}
	if (mode === 'publish' && !containsPlugin) {
		throw new Error(`${plugin_id} has no public listing; complete first-submission approval first`);
	}
}

function escapeRegex(value) {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (process.argv[1] && resolve(process.argv[1]) === script_path) {
	await verifyMarketplaceState(process.argv[2]);
}
