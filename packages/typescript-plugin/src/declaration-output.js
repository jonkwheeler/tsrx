/**
 * A target compiler appends editor-only `ImportMetaEnv` / `ImportMeta` globals
 * (`withPlatformTypes` in `@tsrx/core`) to the virtual TSX of a module that
 * uses platform flags, so the flags type-check without `vite/client`. TypeScript
 * keeps every `declare global` block in declaration output, so each emitted
 * `.d.ts` would carry the block: two of them conflict in a consumer (TS2374,
 * duplicate index signature), and they pin the library's platform onto the
 * consumer's `import.meta.env`.
 */

const DECLARATION_FILE = /\.d\.[cm]?ts$/;

/**
 * Matches the generated block by shape: a `declare global` holding only
 * `ImportMetaEnv` with a `platform` member and `ImportMeta` with one index
 * signature.
 *
 * @param {typeof import('typescript')} ts
 * @param {import('typescript').Statement} statement
 */
function is_platform_globals(ts, statement) {
	if (
		!ts.isModuleDeclaration(statement) ||
		!ts.isIdentifier(statement.name) ||
		ts.idText(statement.name) !== 'global' ||
		!statement.body ||
		!ts.isModuleBlock(statement.body) ||
		statement.body.statements.length !== 2
	) {
		return false;
	}
	const [env, meta] = statement.body.statements;
	return (
		ts.isInterfaceDeclaration(env) &&
		ts.idText(env.name) === 'ImportMetaEnv' &&
		env.members.length === 1 &&
		ts.isPropertySignature(env.members[0]) &&
		ts.isIdentifier(env.members[0].name) &&
		ts.idText(env.members[0].name) === 'platform' &&
		ts.isInterfaceDeclaration(meta) &&
		ts.idText(meta.name) === 'ImportMeta' &&
		meta.members.length === 1 &&
		ts.isIndexSignatureDeclaration(meta.members[0])
	);
}

/**
 * @param {typeof import('typescript')} ts
 * @param {string} text
 * @returns {string}
 */
export function strip_platform_globals(ts, text) {
	if (!text.includes('ImportMetaEnv')) return text;
	// `ts` is the classic CLI's compiler-only module scope: it has no
	// `ScriptTarget` binding (99 is `ScriptTarget.Latest`), and its nodes lack the
	// language-service accessors (`text`, `getFullStart()`).
	const source = ts.createSourceFile('output.d.ts', text, 99);
	let result = text;
	for (const statement of [...source.statements].reverse()) {
		if (is_platform_globals(ts, statement)) {
			result = result.slice(0, statement.pos) + result.slice(statement.end);
		}
	}
	return result;
}

/** @type {WeakSet<object>} */
const patched_systems = new WeakSet();

/**
 * Strip the platform globals from every declaration file `ts.sys` writes. Every
 * `tsc` mode (`-p`, `--watch`, `--build`) writes through `ts.sys.writeFile`.
 *
 * @param {typeof import('typescript')} ts
 */
export function strip_platform_globals_from_declaration_output(ts) {
	const system = ts.sys;
	if (patched_systems.has(system)) return;
	patched_systems.add(system);
	const write_file = system.writeFile;
	system.writeFile = (file_name, data, write_byte_order_mark) =>
		write_file.call(
			system,
			file_name,
			DECLARATION_FILE.test(file_name) ? strip_platform_globals(ts, data) : data,
			write_byte_order_mark,
		);
}
