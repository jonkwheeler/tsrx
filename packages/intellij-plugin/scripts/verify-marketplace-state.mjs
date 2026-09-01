import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script_path = fileURLToPath(import.meta.url);
const plugin_id = 'tsrx.intellij-plugin';
const endpoint = `https://plugins.jetbrains.com/plugins/list?pluginId=${plugin_id}`;

export async function detectMarketplaceListing(request = fetch) {
	const response = await request(endpoint);
	if (response.status === 404) return false;
	if (!response.ok) {
		throw new Error(`Marketplace plugin lookup failed with HTTP ${response.status}`);
	}
	return hasMarketplaceListing(await response.text());
}

export function hasMarketplaceListing(xml) {
	return (
		xml.includes('<idea-plugin') &&
		new RegExp(`<id>\\s*${escapeRegex(plugin_id)}\\s*</id>`).test(xml)
	);
}

function escapeRegex(value) {
	return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (process.argv[1] && resolve(process.argv[1]) === script_path) {
	process.stdout.write(`published=${await detectMarketplaceListing()}\n`);
}
