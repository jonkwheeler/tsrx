import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The editor-only `ImportMetaEnv` / `ImportMeta` globals that `withPlatformTypes`
 * in `@tsrx/core` appends to the generated TSX of a module that keeps a platform
 * flag, exactly as it prints them, with the three flag value types captured.
 */
const PLATFORM_GLOBALS =
	/\ndeclare global \{\n\tinterface ImportMetaEnv \{\n\t\treadonly platform: string & \{\n\t\t\treadonly web: (true|false|boolean);\n\t\t\treadonly ios: (true|false|boolean);\n\t\t\treadonly android: (true|false|boolean);\n\t\t\};\n\t\}\n\tinterface ImportMeta \{\n\t\treadonly \[key: `env\$\{string\}`\]: ImportMetaEnv;\n\t\}\n\}\n/;

/** The `platform-globals/` file that declares each set of flag value types. */
const PLATFORM_FILES = new Map([
	['true,false,false', 'web'],
	['false,true,false', 'ios'],
	['false,false,true', 'android'],
	['boolean,boolean,boolean', 'unconfigured'],
]);

/** @type {Map<string, string | null>} */
const specifiers = new Map();

/**
 * Replace a module's copy of the platform globals in its generated TSX with a
 * type-only import of the shared file that declares the same globals. Native
 * TypeScript merges every module's copy into one `ImportMeta` and reports the
 * repeated index signature (TS2374), and declaration output keeps every
 * `declare global` block. The shared file is in the program once, and a
 * module's declaration output drops an import that none of its exports use.
 * The copy is blanked in place, so every generated offset stays put, and the
 * import goes at the end of the text. Text without the exact copy (another
 * TSRX version, a third-party compiler) comes back unchanged.
 * @param {string} text
 * @returns {string}
 */
export function share_platform_globals(text) {
	const match = PLATFORM_GLOBALS.exec(text);
	const name = match && PLATFORM_FILES.get(match.slice(1).join(','));
	const specifier = name && platform_globals_specifier(name);
	if (!match || !specifier) return text;
	const end = match.index + match[0].length;
	return `${text.slice(0, match.index)}${match[0].replace(/[^\n]/g, ' ')}${text.slice(end)}\nimport type {} from ${JSON.stringify(specifier)};\n`;
}

/**
 * The module specifier of a `platform-globals/` file: its absolute path with
 * forward slashes, and the `.cjs` extension that resolves to its `.d.cts`. The
 * directory sits next to `src/` and `dist/`, so one relative URL serves both. A
 * file missing from the installed package leaves the copy in place.
 * @param {string} name
 * @returns {string | null}
 */
function platform_globals_specifier(name) {
	let specifier = specifiers.get(name);
	if (specifier === undefined) {
		const file = fileURLToPath(new URL(`../platform-globals/${name}.d.cts`, import.meta.url));
		specifier = fs.existsSync(file) ? file.replace(/\\/g, '/').replace(/\.d\.cts$/, '.cjs') : null;
		specifiers.set(name, specifier);
	}
	return specifier;
}
