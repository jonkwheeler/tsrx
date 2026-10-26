import { isCodeActionsEnabled, isCompletionEnabled } from '@volar/language-core';
import {
	getMappingOffset,
	toGeneratedOffset,
	transformFileTextChanges,
} from '@volar/typescript/lib/node/transform.js';
import { getServiceScript } from '@volar/typescript/lib/node/utils.js';

/** The language service methods whose edits add imports. */
const IMPORT_EDIT_METHODS = new Set([
	'getCodeFixesAtPosition',
	'getCombinedCodeFix',
	'getCompletionEntryDetails',
]);

/**
 * In tsserver, Volar gives TypeScript a `.tsrx` file as blank lines as long as the
 * source, followed by the generated code. TypeScript adds the first import of a file
 * at its start, in those blank lines, where no mapping reaches, so the import was
 * lost (#828). Move such an insertion to the start of the generated code, which maps
 * to the start of the source.
 *
 * Wraps the language service that Volar's proxy maps, so the proxy maps the moved
 * edits.
 * @template {import('typescript').LanguageService} T
 * @param {T} languageService the language service Volar's proxy wraps
 * @param {() => import('@volar/language-core').Language<string> | undefined} get_language
 * @returns {T}
 */
export function with_top_of_file_imports(languageService, get_language) {
	return new Proxy(languageService, {
		get(target, property, receiver) {
			const method = /** @type {Function} */ (Reflect.get(target, property, receiver));
			if (typeof property !== 'string' || !IMPORT_EDIT_METHODS.has(property)) {
				return method;
			}
			return (/** @type {unknown[]} */ ...args) => {
				const result = method.apply(target, args);
				const language = get_language();
				if (language) {
					for (const changes of file_text_changes_of(property, result)) {
						move_top_of_file_insertions(language, changes);
					}
				}
				return result;
			};
		},
	});
}

/**
 * The `FileTextChanges` in the result of one of `IMPORT_EDIT_METHODS`.
 * @param {string} method
 * @param {any} result
 * @returns {import('typescript').FileTextChanges[]}
 */
function file_text_changes_of(method, result) {
	switch (method) {
		case 'getCodeFixesAtPosition':
			return result?.flatMap((/** @type {any} */ fix) => fix.changes) ?? [];
		case 'getCombinedCodeFix':
			return result?.changes ?? [];
		default:
			return result?.codeActions?.flatMap((/** @type {any} */ action) => action.changes) ?? [];
	}
}

/**
 * @param {import('@volar/language-core').Language<string>} language
 * @param {import('typescript').FileTextChanges} changes
 */
function move_top_of_file_insertions(language, changes) {
	const [service_script] = getServiceScript(language, changes.fileName.replace(/\\/g, '/'));
	if (!service_script) return;
	const generated_start = getMappingOffset(language, service_script);
	for (const change of changes.textChanges) {
		if (change.span.start === 0 && change.span.length === 0) {
			change.span = { start: generated_start, length: 0 };
		}
	}
}

/**
 * Map the edits of a completion the way the proxy maps a quick fix's: through
 * mappings that enable code actions, as well as mappings that enable completions.
 * Volar maps a completion's edits only through the second kind, but an auto-import
 * completion edits the imports, whose line starts map only for code actions, so a
 * completion that adds an import line inserted nothing (#1026) while the quick fix
 * on the same name added it.
 * @template {object} T
 * @param {T} languageService the language service Volar's proxy returns
 * @param {() => import('typescript').LanguageService | undefined} get_original the language service the proxy wraps
 * @param {() => import('@volar/language-core').Language<string> | undefined} get_language
 * @returns {T}
 */
export function with_completion_import_edits(languageService, get_original, get_language) {
	return new Proxy(languageService, {
		get(target, property, receiver) {
			const method = Reflect.get(target, property, receiver);
			if (property !== 'getCompletionEntryDetails') {
				return method;
			}
			const get_details =
				/** @type {import('typescript').LanguageService['getCompletionEntryDetails']} */ (method);
			/** @type {import('typescript').LanguageService['getCompletionEntryDetails']} */
			return (file_name, position, ...rest) => {
				const original = get_original();
				const language = get_language();
				const [service_script, target_script, source_script] = language
					? getServiceScript(language, file_name.replace(/\\/g, '/'))
					: [];
				if (!original || !language || !service_script || !target_script || !source_script) {
					return get_details.call(target, file_name, position, ...rest);
				}
				const generated = toGeneratedOffset(
					language,
					service_script,
					source_script,
					position,
					isCompletionEnabled,
				);
				if (generated === undefined) return undefined;
				const details = original.getCompletionEntryDetails(target_script.id, generated, ...rest);
				for (const action of details?.codeActions ?? []) {
					action.changes = transformFileTextChanges(
						language,
						action.changes,
						false,
						(data) => isCompletionEnabled(data) || isCodeActionsEnabled(data),
					);
				}
				return details;
			};
		},
	});
}
