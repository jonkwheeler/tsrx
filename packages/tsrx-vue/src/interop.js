const vue_import_pattern = /import(?!\s+type)\s*\{([\s\S]*?)\}\s*from\s*(['"])vue\2\s*;?/g;

/**
 * Vue's built-in renderer primitives, including `Suspense`, need Vapor/VDOM
 * interop when mounted from a Vapor app. TSRX can emit `Suspense` for
 * `try/pending`, so bundler plugins use this rewrite to make Vapor app
 * creation install the interop plugin without every app entry point needing to
 * remember it.
 *
 * @param {string} source
 * @returns {string}
 */
export function addVaporInteropToCreateVaporApp(source) {
	if (!/\bcreateVaporApp\b/.test(source) || !/\bfrom\s*['"]vue['"]/.test(source)) {
		return source;
	}

	const code_offsets = find_code_offsets(source);

	/** @type {string | null} */
	let existing_interop_local = null;

	for (const match of source.matchAll(vue_import_pattern)) {
		if (!code_offsets[/** @type {number} */ (match.index)]) continue;
		for (const specifier of split_import_specifiers(match[1])) {
			const parsed = parse_import_specifier(specifier);
			if (parsed?.imported === 'vaporInteropPlugin') {
				existing_interop_local = parsed.local;
				break;
			}
		}
		if (existing_interop_local) break;
	}

	if (existing_interop_local && source.includes(`.use(${existing_interop_local})`)) {
		return source;
	}

	const interop_local = existing_interop_local ?? 'vaporInteropPlugin';
	let added_interop_import = existing_interop_local !== null;

	return source.replace(vue_import_pattern, (full, specifier_text, quote, offset) => {
		if (!code_offsets[offset]) {
			return full;
		}
		const specifiers = split_import_specifiers(specifier_text);
		/** @type {string[]} */
		const wrappers = [];
		let import_changed = false;

		const next_specifiers = specifiers.map((specifier) => {
			const parsed = parse_import_specifier(specifier);
			if (parsed?.imported !== 'createVaporApp') {
				return specifier.trim();
			}

			const wrapped_local = `__tsrx_${parsed.local}`;
			wrappers.push(
				`const ${parsed.local} = (...args) => ${wrapped_local}(...args).use(${interop_local});`,
			);
			import_changed = true;
			return `createVaporApp as ${wrapped_local}`;
		});

		if (!import_changed) {
			return full;
		}

		if (!added_interop_import) {
			next_specifiers.push(interop_local);
			added_interop_import = true;
		}

		return `import { ${next_specifiers.join(', ')} } from ${quote}vue${quote};\n${wrappers.join('\n')}`;
	});
}

// A `/` at the start of the source or after one of these starts a regular
// expression rather than a division.
const REGEXP_PRECEDERS = '(,=:[!&|?{};+-*%<>~^';

/**
 * Mark the offsets of `source` that are code, not the inside of a comment,
 * string, template literal or regular expression, so import-like text in those
 * is never rewritten. A quoted string or regular expression ends at a line
 * break at the latest, so a misread recovers on the next line.
 *
 * @param {string} source
 * @returns {Uint8Array} 1 at each code offset
 */
function find_code_offsets(source) {
	const code_offsets = new Uint8Array(source.length);
	scan_code(source, 0, code_offsets);
	return code_offsets;
}

/**
 * @param {string} source
 * @param {number} index
 * @param {Uint8Array | null} code_offsets null inside a template substitution,
 *   which ends at its unmatched `}`
 * @returns {number} the offset after the scanned code
 */
function scan_code(source, index, code_offsets) {
	let depth = 0;
	let previous = '';
	while (index < source.length) {
		const char = source[index];
		const next = source[index + 1];
		if (char === '/' && next === '/') {
			const end = source.indexOf('\n', index);
			index = end === -1 ? source.length : end;
		} else if (char === '/' && next === '*') {
			const end = source.indexOf('*/', index + 2);
			index = end === -1 ? source.length : end + 2;
		} else if (
			char === '"' ||
			char === "'" ||
			(char === '/' && REGEXP_PRECEDERS.includes(previous))
		) {
			index = skip_quoted(source, index + 1, char);
			previous = char;
		} else if (char === '`') {
			index = skip_template(source, index + 1);
			previous = char;
		} else {
			if (code_offsets) {
				code_offsets[index] = 1;
			} else if (char === '{') {
				depth++;
			} else if (char === '}' && depth-- === 0) {
				return index + 1;
			}
			if (!/\s/.test(char)) previous = char;
			index++;
		}
	}
	return index;
}

/**
 * @param {string} source
 * @param {number} index the offset after the opening quote or `/`
 * @param {string} quote
 * @returns {number} the offset after the closing quote or `/`
 */
function skip_quoted(source, index, quote) {
	let in_class = false;
	while (index < source.length) {
		const char = source[index];
		if (char === '\\') {
			index += 2;
			continue;
		}
		if (char === '\n') return index;
		index++;
		if (quote === '/' && char === '[') in_class = true;
		else if (quote === '/' && char === ']') in_class = false;
		else if (char === quote && !in_class) return index;
	}
	return index;
}

/**
 * @param {string} source
 * @param {number} index the offset after the opening backtick
 * @returns {number} the offset after the closing backtick
 */
function skip_template(source, index) {
	while (index < source.length) {
		const char = source[index];
		if (char === '\\') {
			index += 2;
		} else if (char === '`') {
			return index + 1;
		} else if (char === '$' && source[index + 1] === '{') {
			index = scan_code(source, index + 2, null);
		} else {
			index++;
		}
	}
	return index;
}

/**
 * @param {string} specifier_text
 * @returns {string[]}
 */
function split_import_specifiers(specifier_text) {
	return specifier_text
		.split(',')
		.map((specifier) => specifier.trim())
		.filter(Boolean);
}

/**
 * @param {string} specifier
 * @returns {{ imported: string, local: string } | null}
 */
function parse_import_specifier(specifier) {
	const match = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(specifier.trim());
	if (!match) {
		return null;
	}
	return { imported: match[1], local: match[2] ?? match[1] };
}
