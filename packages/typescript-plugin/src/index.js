import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';
import { getTsrxLanguagePlugin } from './language.js';

// This TypeScript plugin is loaded by TypeScript's tsserver when configured in tsconfig.json.
// Note: When using the TSRX VS Code extension, the language server handles everything,
// so this plugin is redundant but harmless (both instances work independently).
// This plugin is useful for non-VS Code editors or when not using the language server.
export default createLanguageServicePlugin((ts, info) => ({
	languagePlugins: [
		getTsrxLanguagePlugin({
			ts,
			configFileName:
				info.project.projectKind === ts.server.ProjectKind.Configured
					? info.project.getProjectName()
					: undefined,
			configHost: ts.sys,
		}),
	],
}));
