/** @import { BunPlugin } from 'bun' */
/** @import { Platform, RuntimeImportMode } from '@tsrx/hono' */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { mergePlatformDefinitions, validatePlatform } from '@tsrx/core';
import { compile as compileServer } from '@tsrx/hono';
import { compile as compileDom } from '@tsrx/hono/dom';
import { resolveBuildPlatform } from '@tsrx/core/config';

const TSRX_EXTENSION_PATTERN = /\.tsrx$/;
const CSS_QUERY = '?tsrx-css&lang.css';
const CSS_QUERY_PATTERN = /\?tsrx-css&lang\.css$/;
const CSS_NAMESPACE = '@tsrx/bun-plugin-hono-css';

/**
 * @typedef {'server' | 'dom'} TsrxHonoMode
 * Hono-specific adapters remain under `@tsrx/hono/*` in direct mode.
 *
 * @typedef {{
 *   mode?: TsrxHonoMode,
 *   emitCss?: boolean,
 *   runtimeImports?: RuntimeImportMode,
 *   platform?: Platform,
 * }} TsrxHonoBunPluginOptions
 */

/**
 * Directory the tsconfig lookup starts from. Without `root`, Bun builds from
 * the common ancestor directory of the entrypoints, so the nearest tsconfig is
 * searched from there. A relative `tsconfig` option resolves from the working
 * directory.
 *
 * @param {{ root?: string, tsconfig?: unknown, entrypoints?: unknown[] }} build_config
 * @returns {string}
 */
function get_tsconfig_base(build_config) {
	if (build_config.root) return build_config.root;
	const entrypoints = (build_config.entrypoints ?? []).filter(
		(entrypoint) => typeof entrypoint === 'string',
	);
	if (typeof build_config.tsconfig === 'string' || entrypoints.length === 0) {
		return process.cwd();
	}

	let base = path.dirname(path.resolve(entrypoints[0]));
	for (const entrypoint of entrypoints) {
		const file_path = path.resolve(entrypoint);
		while (/^\.\.(?:[/\\]|$)/.test(path.relative(base, file_path))) {
			base = path.dirname(base);
		}
	}
	return base;
}

/**
 * Compile `.tsrx` files and pass the resulting TSX through Bun's automatic
 * JSX transform. Hono's server and DOM runtimes are explicit modes because
 * changing only the JSX import source would leave compiler-injected helpers
 * pointed at the wrong runtime.
 *
 * @param {TsrxHonoBunPluginOptions} [options]
 * @returns {BunPlugin}
 */
export function tsrxHono(options = {}) {
	const mode = options.mode ?? 'server';
	if (mode !== 'server' && mode !== 'dom') {
		throw new TypeError(`@tsrx/bun-plugin-hono: invalid mode ${JSON.stringify(mode)}`);
	}
	const jsx_import_source = mode === 'dom' ? 'hono/jsx/dom' : 'hono/jsx';
	const compile = mode === 'dom' ? compileDom : compileServer;
	const emit_css = options.emitCss ?? true;
	const explicit_platform = validatePlatform(options.platform);

	/** @type {Map<string, string>} */
	const css_cache = new Map();

	/** @param {string} code @param {string} id @param {string | undefined} css @param {boolean} emit_css */
	function append_css_import(code, id, css, emit_css) {
		if (!emit_css || !css) {
			css_cache.delete(id);
			return code;
		}
		css_cache.set(id, css);
		return `${code}\nimport ${JSON.stringify(id)};\n`;
	}

	return {
		name: '@tsrx/bun-plugin-hono',

		setup(build) {
			const build_config = build.config ?? {};
			const platform = resolveBuildPlatform({
				root: get_tsconfig_base(build_config),
				tsconfig: typeof build_config.tsconfig === 'string' ? build_config.tsconfig : undefined,
				platform: explicit_platform,
				integration: '@tsrx/bun-plugin-hono',
			});
			const compile_options = { runtimeImports: options.runtimeImports, platform };
			if (platform !== undefined && build.config) {
				build.config.define = /** @type {Record<string, string>} */ (
					mergePlatformDefinitions(build.config.define, platform, {
						integration: 'Bun',
						serialize: true,
					})
				);
			}

			build.onResolve({ filter: CSS_QUERY_PATTERN }, (args) => {
				if (!css_cache.has(args.path)) return undefined;
				return { path: args.path, namespace: CSS_NAMESPACE };
			});

			build.onLoad({ filter: CSS_QUERY_PATTERN, namespace: CSS_NAMESPACE }, (args) => ({
				contents: css_cache.get(args.path) ?? '',
				loader: 'css',
			}));

			build.onLoad({ filter: TSRX_EXTENSION_PATTERN, namespace: 'file' }, async (args) => {
				const source = await readFile(args.path, 'utf-8');
				const { code, css } = compile(source, args.path, compile_options);
				const css_id = args.path + CSS_QUERY;
				const output = append_css_import(code, css_id, css, emit_css);

				return {
					// Bun's own TSX transform picks the development or production JSX
					// runtime for the build. The pragma selects only the import source.
					contents: `/** @jsxImportSource ${jsx_import_source} */\n${output}`,
					loader: 'tsx',
				};
			});
		},
	};
}

export default tsrxHono;
