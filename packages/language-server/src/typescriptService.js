/**
 * @import {LanguageServiceContext} from '@volar/language-server'
 * @import {TextDocument} from 'vscode-languageserver-textdocument'
 */

import { createRequire } from 'node:module';

// Monkey-patch getUserPreferences to inject TSRX-specific defaults.
// We use createRequire to get the raw CJS module.exports object, bypassing
// the bundler's __toESM wrapper which interferes with property assignment.
// volar-service-typescript is also externalized (via regex in tsdown config)
// so that its internal consumers (semantic.js, codeAction.js, etc.) load
// getUserPreferences from the same Node module cache entry we patch here.
const require = createRequire(import.meta.url);
const getUserPreferencesModule = require('volar-service-typescript/lib/configs/getUserPreferences');
const { create } = require('volar-service-typescript');

const originalGetUserPreferences = getUserPreferencesModule.getUserPreferences;

/**
 * Enhanced getUserPreferences to add TypeScript and TSRX preferences.
 * Specifically makes preferTypeOnlyAutoImports true if not set
 * @param {LanguageServiceContext} context
 * @param {TextDocument} document
 */
getUserPreferencesModule.getUserPreferences = async function (context, document) {
	const origPreferences = await originalGetUserPreferences.call(this, context, document);

	const [tsConfig, tsrxConfig] = await Promise.all([
		context.env.getConfiguration?.('typescript'),
		context.env.getConfiguration?.('tsrx'),
	]);

	return {
		preferTypeOnlyAutoImports: true,
		...origPreferences,
		.../** @type {any} */ (tsConfig)?.preferences,
		.../** @type {any} */ (tsrxConfig)?.preferences,
	};
};

/**
 * Create TypeScript services with TSRX-specific enhancements.
 * @param {typeof import('typescript')} ts
 * @returns {ReturnType<typeof create>}
 */
export function createTypeScriptServices(ts) {
	return create(ts);
}
