import path from 'node:path';
import { parse } from '@tsrx/react';

const CLIENT_QUERY = '?tsrx-client&lang.tsx';

/**
 * @typedef {{
 * 	resourcePath: string,
 * 	async: () => (err: unknown, output?: string | null) => void,
 * }} LoaderContext
 */

/** @typedef {ReturnType<typeof parse>} Program */

/**
 * @param {{ type: string, name?: string, value?: unknown }} node
 * @returns {unknown}
 */
function export_name(node) {
	return node.type === 'Identifier' ? node.name : node.value;
}

/**
 * Whether the module has a runtime default export, which `export *` does not
 * re-export.
 *
 * @param {Program} ast
 * @returns {boolean}
 */
function has_default_export(ast) {
	return ast.body.some((node) => {
		const export_kind = /** @type {any} */ (node).exportKind;
		if (export_kind === 'type') return false;
		switch (node.type) {
			case 'ExportDefaultDeclaration':
				return /** @type {any} */ (node.declaration).type !== 'TSInterfaceDeclaration';
			case 'ExportAllDeclaration':
				return node.exported != null && export_name(node.exported) === 'default';
			case 'ExportNamedDeclaration':
				return node.specifiers.some(
					(specifier) =>
						/** @type {any} */ (specifier).exportKind !== 'type' &&
						export_name(specifier.exported) === 'default',
				);
			default:
				return false;
		}
	});
}

/**
 * Emits the module that a `'use client'` `.tsrx` file is imported as: the
 * directive and a re-export of the compiled module, which the Turbopack config
 * helper compiles for the client query.
 *
 * @this {LoaderContext}
 * @param {string} source
 * @returns {void}
 */
export default function tsrx_react_turbopack_client_boundary_loader(source) {
	const callback = this.async();

	try {
		const ast = parse(source, this.resourcePath);
		const specifier = JSON.stringify(`./${path.basename(this.resourcePath)}${CLIENT_QUERY}`);
		let output = '';
		for (const node of ast.body) {
			const directive = 'directive' in node && node.directive;
			if (!directive) break;
			if (directive === 'use client') output += `'use client';\n`;
		}
		output += `export * from ${specifier};\n`;
		if (has_default_export(ast)) output += `export { default } from ${specifier};\n`;
		callback(null, output);
	} catch (/** @type {any} */ err) {
		callback(err);
	}
}
