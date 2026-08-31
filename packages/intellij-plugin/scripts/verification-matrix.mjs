import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script_path = fileURLToPath(import.meta.url);
const package_dir = resolve(dirname(script_path), '..');

export function createVerificationMatrix(propertiesText) {
	const properties = readProperties(propertiesText);
	const minimumVersion = requiredProperty(properties, 'minimumPlatformVersion');
	const productTypes = requiredProperty(properties, 'advertisedProductTypes')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	if (new Set(productTypes).size !== productTypes.length) {
		throw new Error('advertisedProductTypes must not contain duplicates');
	}
	for (const anchor of ['WebStorm', 'IntellijIdeaUltimate']) {
		if (!productTypes.includes(anchor)) {
			throw new Error(`advertisedProductTypes must include ${anchor}`);
		}
	}

	const include = [
		matrixEntry('WebStorm', minimumVersion, 'minimum'),
		matrixEntry('IntellijIdeaUltimate', minimumVersion, 'minimum'),
		...productTypes.map((productType) => matrixEntry(productType, 'latest', 'current')),
	];
	return { include };
}

function matrixEntry(productType, productVersion, channel) {
	return {
		productType,
		productVersion,
		channel,
		slug: `${productType}-${channel}`.replaceAll(/[^a-z0-9-]/gi, '-').toLowerCase(),
	};
}

function readProperties(content) {
	return Object.fromEntries(
		content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
			.map((line) => {
				const separator = line.indexOf('=');
				if (separator < 1) throw new Error(`Invalid Gradle property: ${line}`);
				return [line.slice(0, separator), line.slice(separator + 1)];
			}),
	);
}

function requiredProperty(properties, name) {
	const value = properties[name]?.trim();
	if (!value) throw new Error(`Missing Gradle property: ${name}`);
	return value;
}

if (process.argv[1] && resolve(process.argv[1]) === script_path) {
	const properties = readFileSync(resolve(package_dir, 'gradle.properties'), 'utf8');
	process.stdout.write(`${JSON.stringify(createVerificationMatrix(properties))}\n`);
}
