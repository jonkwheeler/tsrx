import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformVueJsxVapor } = require('vue-jsx-vapor/api');
// vue-jsx-vapor's plugin hooks as its Rollup plugin. Called outside Rollup,
// each hook applies its own `filter` first, as unplugin does for Rollup
// versions without hook filters.
const { default: create_vue_jsx_vapor_plugins } = require('vue-jsx-vapor/rollup');

// The macros import helper modules by ids such as `/vue-jsx-vapor/props`.
export const VAPOR_HELPER_ID_PATTERN = /^\/vue-jsx-vapor\//;
// A `defineStyle` stylesheet: `lang.css`, or `lang.module.css` for a CSS module.
export const VAPOR_STYLESHEET_ID_PATTERN =
	/^\/vue-jsx-vapor\/macros\/define-style\/.*&lang\.(module\.)?(\w+)$/;

const DEFAULT_VAPOR_OPTIONS = {
	macros: true,
	compiler: {
		runtimeModuleName: 'vue-jsx-vapor',
	},
};

/**
 * @typedef {{ macros?: boolean | object, compiler?: { runtimeModuleName?: string } }} VaporOptions
 * @typedef {{ code: string, map?: unknown }} VaporHookResult
 * @typedef {((...args: string[]) => unknown) | { handler: (...args: string[]) => unknown }} VueJsxVaporHook
 * @typedef {{ name: string, load?: VueJsxVaporHook, transform?: VueJsxVaporHook }} VueJsxVaporPlugin
 */

/**
 * @param {VaporOptions | undefined} options
 */
function resolve_vapor_options(options) {
	const { interop: _interop, ...rest } = /** @type {VaporOptions & { interop?: boolean }} */ (
		options ?? {}
	);
	return {
		...DEFAULT_VAPOR_OPTIONS,
		...rest,
		compiler: {
			...DEFAULT_VAPOR_OPTIONS.compiler,
			...rest.compiler,
		},
	};
}

/**
 * Calls a vue-jsx-vapor plugin hook and returns the code it produced, if any.
 *
 * @param {VueJsxVaporHook} hook
 * @param {...string} args
 * @returns {Promise<VaporHookResult | undefined>}
 */
async function call_vapor_hook(hook, ...args) {
	const result = /** @type {string | VaporHookResult | null | undefined} */ (
		await (typeof hook === 'function' ? hook : hook.handler)(...args)
	);
	return typeof result === 'string' ? { code: result } : (result ?? undefined);
}

/**
 * vue-jsx-vapor set up as its Vite plugin sets it up: the macros, unless
 * `macros` is false, expand before the Vapor transform, and the helper modules
 * they import load through the same plugin hooks.
 *
 * @param {VaporOptions | undefined} options
 */
export function create_vue_jsx_vapor(options) {
	const vapor_options = resolve_vapor_options(options);
	/** @type {VueJsxVaporPlugin[]} */
	const plugins = [create_vue_jsx_vapor_plugins(vapor_options)].flat();
	const macros = plugins.find((plugin) => plugin.name === '@vue-jsx-vapor/macros')?.transform;

	return {
		/**
		 * Expands the macros, unless their `include` and `exclude` options leave
		 * the module out, then runs the Vapor transform.
		 *
		 * @param {string} code
		 * @param {string} file_path the `.tsrx` module's path
		 * @returns {Promise<{ code: string, maps: unknown[] }>} the code, and the
		 *   source map of each step in order
		 */
		async transform(code, file_path) {
			// The macros' `include` and `exclude` see the id the Vite plugin gives it.
			const expanded = macros ? await call_vapor_hook(macros, code, `${file_path}.tsx`) : undefined;
			// vue-jsx-vapor's HMR code is written for Vite's `import.meta.hot`, and its
			// SSR output is for Vue's server renderer, so both stay off, as in
			// vue-jsx-vapor's own Rspack plugin.
			const result = transformVueJsxVapor(
				expanded?.code ?? code,
				file_path.replace(/\.tsrx$/, '.tsx'),
				vapor_options,
				true,
				false,
				false,
			);
			return {
				code: result.code,
				maps: [expanded?.map, result.map ? JSON.parse(result.map) : undefined],
			};
		},

		/**
		 * Loads a helper module by its `/vue-jsx-vapor/…` id, then runs the
		 * transforms for helper modules, such as the one that compiles a
		 * `defineStyle` stylesheet.
		 *
		 * @param {string} id
		 * @returns {Promise<string | undefined>}
		 */
		async load_helper(id) {
			let code;
			for (const { load } of plugins) {
				code = load && (await call_vapor_hook(load, id))?.code;
				if (code !== undefined) break;
			}
			if (code === undefined) return undefined;
			for (const { transform } of plugins) {
				code = (transform && (await call_vapor_hook(transform, code, id))?.code) ?? code;
			}
			return code;
		},
	};
}

/** @typedef {ReturnType<typeof create_vue_jsx_vapor>} VueJsxVapor */
