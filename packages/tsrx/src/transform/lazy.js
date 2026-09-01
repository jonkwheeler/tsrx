/** @import * as AST from 'estree' */
/** @import * as ESTreeJSX from 'estree-jsx' */
/** @import { BaseNodeMetaData, LazyBinding, LazyContext, LazyPattern, MaybeLocated } from '../../types/index' */

import * as b from '../utils/builders.js';
import {
	child_nodes,
	has_location,
	is_ast_node,
	is_function_or_component_node,
	is_supported_lazy_assignment_position,
	is_transparent_expression_wrapper,
} from '../utils/ast.js';

/**
 * Lazy destructuring transform — framework-agnostic.
 *
 * Shared between `@tsrx/react`, `@tsrx/preact`, `@tsrx/solid`, and `@tsrx/vue`.
 * Walks an AST and rewrites references to names introduced by `&{ ... }` /
 * `&[ ... ]` destructuring patterns into member-expression accesses on a
 * generated source identifier.
 *
 * Usage:
 *   1. Create a context with `createLazyContext()` (or provide any object with
 *      a `lazy_next_id: number` field).
 *   2. Run `preallocateLazyIds(root, context)` once over the full program to
 *      assign stable `metadata.lazy_id` values to every lazy pattern and to
 *      flag function-like nodes whose subtree contains any lazy pattern via
 *      `metadata.has_lazy_descendants`.
 *   3. After converting components to functions, call `applyLazyTransforms(fn,
 *      new Map())` on each top-level function. The function-handler walks the
 *      whole subtree, collects param + body bindings, replaces lazy patterns
 *      with their generated identifiers, and rewrites every reference.
 *
 * The transform is purely AST-to-AST and has no framework-specific knowledge.
 */

/**
 * Create a fresh lazy-id allocation context.
 *
 * @returns {LazyContext}
 */
export function create_lazy_context() {
	return { lazy_next_id: 0 };
}

/**
 * @param {LazyContext} context
 * @returns {string}
 */
function generate_lazy_id(context) {
	return `__lazy${context.lazy_next_id++}`;
}

/**
 * @template {AST.Node} T
 * @param {T} node
 * @param {MaybeLocated | null} [loc_info]
 * @returns {T}
 */
function set_source_location(node, loc_info) {
	if (has_location(loc_info)) {
		node.start = loc_info.start;
		node.end = loc_info.end;
		node.loc = loc_info.loc;
	}
	return node;
}

/**
 * @param {string} name
 * @param {MaybeLocated | null} [loc_info]
 * @param {string} [source_name]
 * @param {number} [source_length]
 * @returns {AST.Identifier}
 */
function create_generated_identifier(name, loc_info, source_name, source_length) {
	const id = b.id(name);
	if (source_name && source_name !== name) id.metadata.source_name = source_name;
	if (source_length != null) id.metadata.source_length = source_length;
	return set_source_location(id, loc_info);
}

/**
 * @param {LazyPattern} pattern
 * @returns {{ start: number, end: number, loc: AST.SourceLocation, source_length: number } | null}
 */
function get_lazy_pattern_mapping_range(pattern) {
	if (!has_location(pattern)) return null;

	const end = pattern.typeAnnotation?.start ?? pattern.end;
	const end_loc = pattern.typeAnnotation?.loc?.start ?? pattern.loc.end;
	return {
		start: pattern.start,
		end,
		loc: {
			start: pattern.loc.start,
			end: end_loc,
		},
		source_length: end - pattern.start,
	};
}

/**
 * @param {AST.Node} node
 * @returns {string | null}
 */
function get_static_property_name(node) {
	if (node.type === 'Identifier') return node.name;
	if (node.type === 'Literal') return String(node.value);
	return null;
}

/**
 * The property keys of an inline object type annotation, by name.
 *
 * @param {AST.TSTypeAnnotation | undefined} type_annotation
 * @returns {Map<string, AST.Identifier | AST.Literal>}
 */
function get_type_property_keys(type_annotation) {
	/** @type {Map<string, AST.Identifier | AST.Literal>} */
	const keys = new Map();
	const type = type_annotation?.typeAnnotation;
	if (type?.type !== 'TSTypeLiteral') return keys;

	for (const member of type.members) {
		if (member.type !== 'TSPropertySignature') continue;
		const key = member.key;
		if (key.type !== 'Identifier' && key.type !== 'Literal') continue;
		const name = get_static_property_name(key);
		if (name != null && !keys.has(name)) keys.set(name, key);
	}

	return keys;
}

/**
 * Store extra mappings from lazy object binding identifiers to generated type
 * property keys. Parser diagnostics for duplicate bindings point at the binding
 * names (`&{ a: value, value }`), while the virtual param only exposes object
 * properties (`__lazy0: { a: ...; value: ... }`).
 *
 * @param {AST.Identifier} lazy_id
 * @param {LazyPattern} pattern
 */
function set_lazy_param_binding_mappings(lazy_id, pattern) {
	if (pattern.type !== 'ObjectPattern') return;

	const type_keys = get_type_property_keys(lazy_id.typeAnnotation);
	if (type_keys.size === 0) return;

	/** @type {NonNullable<BaseNodeMetaData['lazy_param_binding_mappings']>} */
	const mappings = [];
	for (const prop of pattern.properties) {
		if (prop.type === 'RestElement' || prop.computed) continue;

		const value = prop.value;
		const actual = value.type === 'AssignmentPattern' ? value.left : value;
		if (actual.type !== 'Identifier' || !has_location(actual)) continue;

		const key_name = get_static_property_name(prop.key);
		const generated = key_name == null ? null : type_keys.get(key_name);
		if (has_location(generated)) {
			generated.metadata = { ...generated.metadata, disable_verification: true };
			mappings.push({ source: actual, generated });
		}
	}

	if (mappings.length > 0) {
		lazy_id.metadata.lazy_param_binding_mappings = mappings;
	}
}

/**
 * Collect lazy bindings from a destructuring pattern.
 *
 * For `&{ name, age }` on source `S`, maps `name` → `S.name`, `age` → `S.age`.
 * For `&[a, b]` on source `S`, maps `a` → `S[0]`, `b` → `S[1]`. Recurses into
 * nested `ObjectPattern` / `ArrayPattern` values so that `&{ outer: &{ inner } }`
 * on source `S` maps `inner` → `S.outer.inner`, and `&{ pair: &[first, second] }`
 * maps `first` → `S.pair[0]`. Handles `AssignmentPattern` (default values lost,
 * but the binding still resolves to the member chain). Skips `RestElement`.
 *
 * @param {LazyPattern} pattern
 * @param {string} source_name
 * @param {Map<string, LazyBinding>} lazy_bindings
 */
export function collect_lazy_bindings(pattern, source_name, lazy_bindings) {
	collect_lazy_bindings_at(
		pattern,
		source_name,
		() => create_generated_identifier(source_name),
		lazy_bindings,
	);
}

/**
 * Walk a destructure pattern and register a `LazyBinding` for each leaf
 * `Identifier`, where `build_parent` produces the AST expression that reaches
 * this pattern's value from the synthesized source identifier. Each nested
 * level composes its accessor onto `build_parent`, so leaves get the full
 * member chain (e.g. `source.outer.inner` for `&{ outer: &{ inner } }`).
 *
 * @param {LazyPattern} pattern
 * @param {string} source_name
 * @param {LazyBinding['read']} build_parent
 * @param {Map<string, LazyBinding>} lazy_bindings
 */
function collect_lazy_bindings_at(pattern, source_name, build_parent, lazy_bindings) {
	if (pattern.type === 'ObjectPattern') {
		for (const prop of pattern.properties) {
			if (prop.type === 'RestElement') continue;
			const value = prop.value;
			const actual = value.type === 'AssignmentPattern' ? value.left : value;
			const key = prop.key;
			const computed = prop.computed || key.type !== 'Identifier';

			/** @type {LazyBinding['read']} */
			const build_self = (reference) =>
				b.member(
					build_parent(),
					computed || key.type !== 'Identifier'
						? { ...key }
						: create_generated_identifier(key.name, reference, reference?.name),
					computed,
				);

			if (actual.type === 'Identifier') {
				lazy_bindings.set(actual.name, { source_name, read: build_self });
			} else if (actual.type === 'ObjectPattern' || actual.type === 'ArrayPattern') {
				collect_lazy_bindings_at(actual, source_name, build_self, lazy_bindings);
			}
		}
	} else if (pattern.type === 'ArrayPattern') {
		for (let i = 0; i < pattern.elements.length; i++) {
			const element = pattern.elements[i];
			if (!element) continue;
			if (element.type === 'RestElement') continue;
			const actual = element.type === 'AssignmentPattern' ? element.left : element;
			const index = i;

			/** @type {LazyBinding['read']} */
			const build_self = () => b.member(build_parent(), b.literal(index), true);

			if (actual.type === 'Identifier') {
				lazy_bindings.set(actual.name, { source_name, read: build_self });
			} else if (actual.type === 'ObjectPattern' || actual.type === 'ArrayPattern') {
				collect_lazy_bindings_at(actual, source_name, build_self, lazy_bindings);
			}
		}
	}
}

/**
 * Collect lazy bindings from statements at the top level of a block. Reads
 * already-allocated `lazy_id` values from pattern metadata. Handles both
 * `let &[x] = ...` variable declarations and statement-level `&[x] = expr;`
 * assignment expressions.
 *
 * @param {AST.Program['body']} statements
 * @param {Map<string, LazyBinding>} lazy_bindings
 */
export function collect_lazy_bindings_from_statements(statements, lazy_bindings) {
	for (const stmt of statements) {
		if (stmt.type === 'VariableDeclaration') {
			for (const declarator of stmt.declarations) {
				visit_topmost_lazy_patterns(declarator.id, (lazy) => {
					if (!lazy.metadata?.lazy_id) return;
					collect_lazy_bindings(lazy, lazy.metadata.lazy_id, lazy_bindings);
				});
			}
		} else if (stmt.type === 'ExpressionStatement') {
			const assignment = get_standalone_assignment(stmt);
			if (!assignment || assignment.operator !== '=') continue;
			visit_topmost_lazy_patterns(assignment.left, (lazy) => {
				if (!lazy.metadata?.lazy_id) return;
				collect_lazy_bindings(lazy, lazy.metadata.lazy_id, lazy_bindings);
			});
		}
	}
}

/**
 * Unwrap the expression-only wrappers accepted by the lazy-assignment
 * eligibility check and return the standalone assignment they contain.
 * Keeping collection and lowering on the same wrapper definition prevents
 * editor ASTs (`preserveParens`) from silently taking the eager path.
 *
 * @param {AST.ExpressionStatement} statement
 * @returns {AST.AssignmentExpression | null}
 */
function get_standalone_assignment(statement) {
	/** @type {AST.Node} */
	let expression = statement.expression;
	while (expression.type !== 'AssignmentExpression') {
		/** @type {AST.Node | undefined} */
		const child = /** @type {{ expression?: AST.Node }} */ (expression).expression;
		if (!child || !is_transparent_expression_wrapper(expression, child)) return null;
		expression = child;
	}
	return expression;
}

/**
 * Walk a destructure pattern tree, calling `visit` on every *topmost-lazy*
 * descendant — a lazy `ObjectPattern` / `ArrayPattern` with no lazy ancestor
 * within the same pattern tree. Descends through `AssignmentPattern`,
 * `RestElement`, and non-lazy `ObjectPattern` / `ArrayPattern`. Stops at lazy
 * patterns: their inner leaves are reached via accessor chains rooted at the
 * lazy pattern's synthesized id, not by further descent here.
 *
 * @param {AST.Node | null | undefined} pattern
 * @param {(node: LazyPattern) => void} visit
 */
function visit_topmost_lazy_patterns(pattern, visit) {
	if (!pattern || typeof pattern !== 'object') return;
	if (pattern.type === 'AssignmentPattern') {
		visit_topmost_lazy_patterns(pattern.left, visit);
		return;
	}
	if (pattern.type === 'RestElement') {
		visit_topmost_lazy_patterns(pattern.argument, visit);
		return;
	}
	if (pattern.type !== 'ObjectPattern' && pattern.type !== 'ArrayPattern') return;

	if (pattern.lazy) {
		visit(pattern);
		return;
	}

	if (pattern.type === 'ObjectPattern') {
		for (const prop of pattern.properties) {
			if (prop.type === 'RestElement') visit_topmost_lazy_patterns(prop.argument, visit);
			else visit_topmost_lazy_patterns(prop.value, visit);
		}
	} else {
		for (const element of pattern.elements) {
			if (element) visit_topmost_lazy_patterns(element, visit);
		}
	}
}

/**
 * Build the replacement identifier for a lazy pattern. When `is_top` is true
 * (the pattern is itself a function parameter) we carry over the author's
 * `typeAnnotation` if one was written and register source-mapping info. An
 * untyped lazy object param gets NO synthesized annotation: since the source
 * specified no type, the generated param is left implicitly `any` rather than
 * being given a fabricated `{ … : any }` object type. Nested replacements
 * (inside a non-lazy outer destructure) can't carry an inline type annotation —
 * that's not valid syntax — so they get a plain identifier with just source-range
 * info.
 *
 * @param {LazyPattern} pattern
 * @param {string} lazy_id_name the id `preallocate_lazy_ids` assigned
 * @param {boolean} is_top
 * @returns {AST.Identifier}
 */
function build_lazy_id_for_pattern(pattern, lazy_id_name, is_top) {
	const pattern_range = get_lazy_pattern_mapping_range(pattern);
	const lazy_id = pattern_range
		? create_generated_identifier(
				lazy_id_name,
				pattern_range,
				undefined,
				pattern_range.source_length,
			)
		: create_generated_identifier(lazy_id_name);
	if (!is_top) return lazy_id;
	if (pattern.typeAnnotation) {
		lazy_id.typeAnnotation = pattern.typeAnnotation;
	}
	set_lazy_param_binding_mappings(lazy_id, pattern);
	return lazy_id;
}

/**
 * Walk a destructure pattern tree and replace every topmost-lazy pattern with
 * its synthesized id identifier. Non-lazy outer patterns are preserved so a
 * source like `{ pair: &[a, b] }` becomes `{ pair: __lazy0 }`. The `is_top`
 * flag is true only when the caller is invoking on a position that itself
 * binds a single param (so a directly-lazy pattern can carry param-level type
 * info); recursive descent into child patterns passes `false`.
 *
 * @param {AST.Pattern} pattern
 * @param {boolean} [is_top]
 * @returns {AST.Pattern}
 */
function replace_lazy_in_pattern(pattern, is_top = true) {
	if (!pattern || typeof pattern !== 'object') return pattern;

	if (pattern.type === 'AssignmentPattern') {
		const new_left = replace_lazy_in_pattern(pattern.left, is_top);
		return new_left === pattern.left ? pattern : { ...pattern, left: new_left };
	}
	if (pattern.type === 'RestElement') {
		const new_arg = replace_lazy_in_pattern(pattern.argument, false);
		return new_arg === pattern.argument ? pattern : { ...pattern, argument: new_arg };
	}
	if (pattern.type !== 'ObjectPattern' && pattern.type !== 'ArrayPattern') return pattern;

	const lazy_id = pattern.metadata?.lazy_id;
	if (pattern.lazy && lazy_id) {
		return build_lazy_id_for_pattern(pattern, lazy_id, is_top);
	}

	if (pattern.type === 'ObjectPattern') {
		let changed = false;
		const new_properties = pattern.properties.map((prop) => {
			if (prop.type === 'RestElement') {
				const new_arg = replace_lazy_in_pattern(prop.argument, false);
				if (new_arg === prop.argument) return prop;
				changed = true;
				return { ...prop, argument: new_arg };
			}
			const new_value = replace_lazy_in_pattern(prop.value, false);
			if (new_value === prop.value) return prop;
			changed = true;
			return { ...prop, value: new_value };
		});
		return changed ? { ...pattern, properties: new_properties } : pattern;
	}

	let changed = false;
	const new_elements = pattern.elements.map((element) => {
		if (!element) return element;
		const new_element = replace_lazy_in_pattern(element, false);
		if (new_element !== element) changed = true;
		return new_element;
	});
	return changed ? { ...pattern, elements: new_elements } : pattern;
}

/**
 * Rewrite expression-bearing slots in a loop target without walking binding
 * identifiers or non-computed property keys. Computed keys and default RHS
 * values are evaluated while the target is established, so they see the lazy
 * environment active at that point in the loop header.
 *
 * This runs before `replace_lazy_in_pattern`: computed keys inside a lazy
 * pattern become part of the deferred member access collected from that
 * pattern, while defaults surrounding a nested lazy pattern remain in the
 * emitted binding target.
 *
 * @template {AST.Pattern} T
 * @param {T} pattern
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {T}
 */
function transform_loop_pattern_expressions(pattern, lazy_bindings) {
	if (!pattern || typeof pattern !== 'object') return pattern;

	if (pattern.type === 'AssignmentPattern') {
		const new_left = transform_loop_pattern_expressions(pattern.left, lazy_bindings);
		const new_right = apply_lazy_transforms_to_slot(pattern.right, lazy_bindings);
		return new_left !== pattern.left || new_right !== pattern.right
			? /** @type {T} */ ({ ...pattern, left: new_left, right: new_right })
			: pattern;
	}
	if (pattern.type === 'RestElement') {
		const new_argument = transform_loop_pattern_expressions(pattern.argument, lazy_bindings);
		return new_argument === pattern.argument
			? pattern
			: /** @type {T} */ ({ ...pattern, argument: new_argument });
	}
	if (pattern.type === 'ObjectPattern') {
		let changed = false;
		const properties = pattern.properties.map((property) => {
			if (property.type === 'RestElement') {
				const new_argument = transform_loop_pattern_expressions(property.argument, lazy_bindings);
				if (new_argument === property.argument) return property;
				changed = true;
				return rebuild(property, { argument: new_argument });
			}

			const new_key = property.computed
				? apply_lazy_transforms_to_slot(property.key, lazy_bindings)
				: property.key;
			const new_value = transform_loop_pattern_expressions(property.value, lazy_bindings);
			if (new_key === property.key && new_value === property.value) return property;
			changed = true;
			return rebuild(property, { key: new_key, value: new_value });
		});
		return changed ? /** @type {T} */ ({ ...pattern, properties }) : pattern;
	}
	if (pattern.type === 'ArrayPattern') {
		let changed = false;
		const elements = pattern.elements.map((element) => {
			if (!element) return element;
			const new_element = transform_loop_pattern_expressions(element, lazy_bindings);
			if (new_element !== element) changed = true;
			return new_element;
		});
		return changed ? /** @type {T} */ ({ ...pattern, elements }) : pattern;
	}

	return pattern;
}

/**
 * Walk the AST and pre-allocate `lazy_id` metadata on every lazy destructuring
 * pattern: function params, variable declarator ids, bare for-of/in targets,
 * and supported standalone assignment LHS. Walks into non-lazy outer patterns to
 * find nested lazy ones, e.g. `{ pair: &[a, b] }` allocates an id for the inner
 * `&[a, b]`. Idempotent: skips patterns that already have a `lazy_id`.
 *
 * Also stamps `metadata.has_lazy_descendants = true` on every function-like
 * node whose subtree contains any lazy pattern, so `apply_lazy_transforms`
 * can take a constant-time fast path for purely non-lazy functions.
 *
 * @param {AST.Node} root
 * @param {LazyContext} context
 * @param {boolean} [assignments_only]
 */
export function preallocate_lazy_ids(root, context, assignments_only = false) {
	const HAS_LAZY = 1;
	const HAS_VAR_LOOP = 2;
	/** @type {AST.Node[]} */
	const path = [];

	/** @param {AST.Node | null | undefined} pattern */
	const assign_id = (pattern) => {
		visit_topmost_lazy_patterns(pattern, (lazy) => {
			if (lazy.metadata?.lazy_id) return;
			lazy.metadata = { ...lazy.metadata, lazy_id: generate_lazy_id(context) };
		});
	};

	/** @param {AST.Node | null | undefined} pattern */
	const has_preallocated_lazy_binding = (pattern) => {
		let found = false;
		visit_topmost_lazy_patterns(pattern, (lazy) => {
			if (lazy.metadata?.lazy_id) found = true;
		});
		return found;
	};

	/**
	 * @param {unknown} value
	 * @returns {number} bit flags for lazy syntax and current-scope lazy var loops.
	 */
	const visit = (value) => {
		if (!value || typeof value !== 'object') return 0;
		if (Array.isArray(value)) {
			let flags = 0;
			for (const child of value) {
				flags |= visit(child);
			}
			return flags;
		}
		if (!is_ast_node(value)) return 0;

		const node = value;
		const is_function_like = is_function_or_component_node(node);

		if (is_function_like && !assignments_only) {
			for (const param of node.params) {
				assign_id(param.type === 'AssignmentPattern' ? param.left : param);
			}
		}

		if (node.type === 'VariableDeclarator' && !assignments_only) {
			assign_id(node.id);
		}

		if (
			(node.type === 'ForOfStatement' || node.type === 'ForInStatement') &&
			node.left.type !== 'VariableDeclaration'
		) {
			assign_id(node.left);
		}

		if (node.type === 'AssignmentExpression' && is_supported_lazy_assignment_position(node, path)) {
			assign_id(node.left);
		}

		let flags =
			(node.type === 'ObjectPattern' || node.type === 'ArrayPattern') && node.lazy === true
				? HAS_LAZY
				: 0;

		const entries = /** @type {AST.TraversableAstNode} */ (node);
		path.push(node);
		for (const key of Object.keys(entries)) {
			if (key === 'loc' || key === 'start' || key === 'end' || key === 'metadata') continue;
			flags |= visit(entries[key]);
		}
		path.pop();

		const loop_declaration =
			node.type === 'ForStatement'
				? node.init
				: node.type === 'ForOfStatement' || node.type === 'ForInStatement'
					? node.left
					: null;
		if (
			loop_declaration?.type === 'VariableDeclaration' &&
			loop_declaration.kind === 'var' &&
			loop_declaration.declarations.some((declarator) =>
				has_preallocated_lazy_binding(declarator.id),
			)
		) {
			flags |= HAS_VAR_LOOP;
		}

		if (is_function_like) {
			if (flags & HAS_LAZY) {
				node.metadata = { ...node.metadata, has_lazy_descendants: true };
			}
			if (flags & HAS_VAR_LOOP) {
				node.metadata = { ...node.metadata, has_lazy_var_loop_descendants: true };
			}
			// A nested function owns its own var environment. Its caller still
			// needs the general lazy-descendant signal so traversal reaches it,
			// but must not scan for the nested function's loop bindings.
			flags &= ~HAS_VAR_LOOP;
		} else if (node.type === 'StaticBlock') {
			if (flags & HAS_VAR_LOOP) {
				node.metadata = { ...node.metadata, has_lazy_var_loop_descendants: true };
			}
			// Class static blocks own a distinct var environment. Their loop
			// bindings must not be collected by the surrounding function/module.
			flags &= ~HAS_VAR_LOOP;
		} else if (flags & HAS_VAR_LOOP) {
			// Statement containers and their direct statements use this signal to
			// advance function-scoped lazy `var` bindings in source order without
			// rescanning unaffected subtrees during the transform.
			node.metadata = { ...node.metadata, has_lazy_var_loop_descendants: true };
		}

		return flags;
	};

	visit(root);
}

/**
 * Convert an ESTree member-access chain (`__lazy0.Item`, `__lazy0.a.b`) into the
 * equivalent JSX element-name node (a `JSXIdentifier` or `JSXMemberExpression`),
 * so a lazy binding used as a component/element name (`<Item>`) can be rewritten
 * to `<__lazy0.Item>`. Returns null for a computed access (`__lazy0[0]`, from an
 * array destructure), which has no JSX-name form.
 *
 * @param {AST.Expression | AST.Super} expr
 * @param {MaybeLocated | null} [source]
 * @returns {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXMemberExpression | null}
 */
function estree_member_to_jsx_name(expr, source) {
	if (expr.type === 'Identifier') {
		return set_source_location(b.jsx_id(expr.name), source);
	}
	if (expr.type === 'MemberExpression' && !expr.computed && expr.property.type === 'Identifier') {
		const object = estree_member_to_jsx_name(expr.object, source);
		if (!object) return null;
		return set_source_location(b.jsx_member(object, b.jsx_id(expr.property.name)), source);
	}
	return null;
}

/**
 * If a JSX element/component name references a lazy binding, return the rewritten
 * JSX name (`<Item>` → `<__lazy0.Item>`, `<Item.Sub>` → `<__lazy0.Item.Sub>`).
 * Returns null when the name does not reference a lazy binding (or the access has
 * no JSX-name form), so the caller leaves the original name untouched.
 *
 * @param {ESTreeJSX.TSRXJSXOpeningElement['name'] | null | undefined} name
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {ESTreeJSX.JSXIdentifier | ESTreeJSX.JSXMemberExpression | null}
 */
function rewrite_lazy_jsx_name(name, lazy_bindings) {
	if (!name) return null;
	if (name.type === 'JSXIdentifier') {
		const binding = lazy_bindings.get(name.name);
		if (!binding) return null;
		return estree_member_to_jsx_name(binding.read(name), name);
	}
	if (name.type === 'JSXMemberExpression') {
		const new_object = rewrite_lazy_jsx_name(name.object, lazy_bindings);
		return new_object ? { ...name, object: new_object } : null;
	}
	return null;
}

/**
 * Rewrite lazy-binding references in an arbitrary property value: node arrays
 * and single nodes are transformed, everything else (strings, numbers, `null`,
 * positional data) is returned as-is.
 *
 * @param {unknown} value
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {unknown}
 */
function apply_lazy_transforms_to_value(value, lazy_bindings) {
	if (Array.isArray(value)) {
		return value.map((child) => apply_lazy_transforms_to_value(child, lazy_bindings));
	}
	if (!is_ast_node(value)) return value;
	return apply_lazy_transforms(value, lazy_bindings);
}

/**
 * Rebuild `node` with rewritten slots. The transform never changes a slot's
 * syntactic category — an expression stays an expression, a statement stays a
 * statement — so the clone is the same kind of node as the original, which TS
 * cannot verify through a spread of a widened slot value.
 *
 * @template {AST.Node} T
 * @param {T} node
 * @param {Partial<Record<keyof T, unknown>>} changes
 * @returns {T}
 */
function rebuild(node, changes) {
	return /** @type {T} */ ({ ...node, ...changes });
}

/**
 * Rewrite a node that occupies a typed slot (an expression, a statement, a
 * function body). The transform preserves the syntactic category of what it
 * rewrites — an expression stays an expression, a statement stays a statement
 * (a standalone `&[x] = …` statement becomes a `const` declaration) — so the
 * result is re-typed to the slot it came from.
 *
 * @template {AST.Node} T
 * @param {T} node
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {T}
 */
function apply_lazy_transforms_to_slot(node, lazy_bindings) {
	return /** @type {T} */ (apply_lazy_transforms(node, lazy_bindings));
}

/**
 * Add every preallocated lazy binding below a binding pattern to `lazy_bindings`.
 *
 * @param {AST.Node | null | undefined} pattern
 * @param {Map<string, LazyBinding>} lazy_bindings
 */
function collect_preallocated_lazy_bindings(pattern, lazy_bindings) {
	visit_topmost_lazy_patterns(pattern, (lazy) => {
		if (!lazy.metadata?.lazy_id) return;
		collect_lazy_bindings(lazy, lazy.metadata.lazy_id, lazy_bindings);
	});
}

/**
 * Collect lazy `var` bindings introduced by JavaScript loop headers in one
 * statement. The caller installs the collected mappings after transforming
 * that statement, including when the loop is nested in ordinary control flow.
 * Nested functions own a different var environment and are not visited.
 *
 * @param {AST.Node} node
 * @param {Map<string, LazyBinding>} lazy_bindings
 */
function collect_statement_var_loop_bindings(node, lazy_bindings) {
	if (is_function_or_component_node(node) || node.type === 'StaticBlock') return;

	if (
		node.type === 'ForStatement' &&
		node.init?.type === 'VariableDeclaration' &&
		node.init.kind === 'var'
	) {
		for (const declarator of node.init.declarations) {
			collect_preallocated_lazy_bindings(declarator.id, lazy_bindings);
		}
	} else if (
		(node.type === 'ForOfStatement' || node.type === 'ForInStatement') &&
		node.left.type === 'VariableDeclaration' &&
		node.left.kind === 'var'
	) {
		for (const declarator of node.left.declarations) {
			collect_preallocated_lazy_bindings(declarator.id, lazy_bindings);
		}
	}

	for (const child of child_nodes(node)) {
		collect_statement_var_loop_bindings(child, lazy_bindings);
	}
}

/**
 * Install lazy `var` loop bindings introduced by a statement slot before
 * transforming a later-evaluated slot of the same compound statement. The
 * preallocation pass marks only subtrees that can contribute bindings in the
 * current var environment, so unaffected slots keep the existing map without
 * a rescan or allocation.
 *
 * @param {AST.Node} node
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {Map<string, LazyBinding>}
 */
function advance_statement_var_loop_bindings(node, lazy_bindings) {
	if (!node.metadata?.has_lazy_var_loop_descendants) return lazy_bindings;

	/** @type {Map<string, LazyBinding>} */
	const statement_bindings = new Map();
	collect_statement_var_loop_bindings(node, statement_bindings);
	return statement_bindings.size > 0
		? new Map([...lazy_bindings, ...statement_bindings])
		: lazy_bindings;
}

/**
 * Rewrite a statement list in source order, installing lazy `var` loop
 * bindings only after the statement that establishes them. The mapping then
 * remains visible to subsequent statements in the current var environment.
 *
 * @param {AST.Program['body']} statements
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @param {boolean} has_lazy_var_loop_descendants
 * @returns {{ body: AST.Program['body'], lazy_bindings: Map<string, LazyBinding>, changed: boolean }}
 */
function transform_statement_list(statements, lazy_bindings, has_lazy_var_loop_descendants) {
	let effective_bindings = lazy_bindings;
	let changed = false;
	const body = statements.map((statement) => {
		const transformed = apply_lazy_transforms_to_slot(statement, effective_bindings);
		if (transformed !== statement) changed = true;

		if (has_lazy_var_loop_descendants && statement.metadata?.has_lazy_var_loop_descendants) {
			effective_bindings = advance_statement_var_loop_bindings(statement, effective_bindings);
		}

		return transformed;
	});

	return { body, lazy_bindings: effective_bindings, changed };
}

/**
 * Rewrite a classic-for declaration in source order. Later initializers can
 * read lazy names introduced by earlier declarators, while the initializer of
 * each declarator is evaluated before that declarator's own lazy bindings are
 * installed.
 *
 * @param {AST.VariableDeclaration} declaration
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {{ declaration: AST.VariableDeclaration, lazy_bindings: Map<string, LazyBinding> }}
 */
function transform_classic_for_declaration(declaration, lazy_bindings) {
	let effective_bindings = lazy_bindings;
	/** @type {Map<string, LazyBinding> | null} */
	let mutable_bindings = null;
	let changed = false;
	const declarations = declaration.declarations.map((declarator) => {
		const new_init =
			declarator.init && apply_lazy_transforms_to_slot(declarator.init, effective_bindings);
		const expression_id = transform_loop_pattern_expressions(declarator.id, effective_bindings);
		const new_id = replace_lazy_in_pattern(expression_id);
		if (new_init !== declarator.init || new_id !== declarator.id) changed = true;

		/** @type {Map<string, LazyBinding>} */
		const own_bindings = new Map();
		collect_preallocated_lazy_bindings(expression_id, own_bindings);
		if (own_bindings.size > 0) {
			mutable_bindings ??= new Map(effective_bindings);
			for (const [name, binding] of own_bindings) mutable_bindings.set(name, binding);
			effective_bindings = mutable_bindings;
		}

		return new_init !== declarator.init || new_id !== declarator.id
			? rebuild(declarator, { id: new_id, init: new_init })
			: declarator;
	});

	return {
		declaration: changed ? rebuild(declaration, { declarations }) : declaration,
		lazy_bindings: effective_bindings,
	};
}

/**
 * Rewrite a for-of/in binding target and return the lazy bindings visible in
 * the loop body. Bare targets become per-iteration `const` declarations so all
 * generated source identifiers have an owning declaration.
 *
 * @param {AST.ForOfStatement['left'] | AST.ForInStatement['left']} left
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {{ left: AST.VariableDeclaration, lazy_bindings: Map<string, LazyBinding> } | { left: AST.ForOfStatement['left'] | AST.ForInStatement['left'], lazy_bindings: Map<string, LazyBinding> }}
 */
function transform_for_each_left(left, lazy_bindings) {
	/** @type {Map<string, LazyBinding>} */
	const own_bindings = new Map();

	if (left.type === 'VariableDeclaration') {
		let changed = false;
		const declarations = left.declarations.map((declarator) => {
			const expression_id = transform_loop_pattern_expressions(declarator.id, lazy_bindings);
			collect_preallocated_lazy_bindings(expression_id, own_bindings);
			const new_id = replace_lazy_in_pattern(expression_id);
			if (new_id === declarator.id) return declarator;
			changed = true;
			return rebuild(declarator, { id: new_id });
		});
		return {
			left: changed ? rebuild(left, { declarations }) : left,
			lazy_bindings: own_bindings,
		};
	}

	const expression_left = transform_loop_pattern_expressions(left, lazy_bindings);
	collect_preallocated_lazy_bindings(expression_left, own_bindings);
	if (own_bindings.size === 0) return { left: expression_left, lazy_bindings: own_bindings };

	const new_id = replace_lazy_in_pattern(expression_left);
	return {
		left: b.declaration('const', [b.declarator(new_id)]),
		lazy_bindings: own_bindings,
	};
}

/**
 * Recursively rewrite lazy-binding references in `node`.
 *
 * @param {AST.Node} node
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {AST.Node}
 */
export function apply_lazy_transforms(node, lazy_bindings) {
	if (!node || typeof node !== 'object') return node;

	if (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression'
	) {
		// Default parameter values are evaluated in the outer scope — transform them first.
		let params_changed = false;
		const new_params = node.params.map((param) => {
			const transformed = transform_param_defaults(param, lazy_bindings);
			if (transformed !== param) params_changed = true;
			return transformed;
		});

		/** @type {Set<string>} */
		const shadowed = new Set();
		for (const param of node.params) {
			collect_shadowed_names(param, lazy_bindings, shadowed);
		}

		const outer_minus_shadow =
			shadowed.size > 0 ? remove_shadowed(lazy_bindings, shadowed) : lazy_bindings;

		/** @type {Map<string, LazyBinding>} */
		const own_bindings = new Map();
		let had_lazy_param = false;
		for (const param of node.params) {
			visit_topmost_lazy_patterns(param, (lazy) => {
				if (!lazy.metadata?.lazy_id) return;
				had_lazy_param = true;
				collect_lazy_bindings(lazy, lazy.metadata.lazy_id, own_bindings);
			});
		}

		// Own bindings override any outer binding with the same name.
		const inner_bindings =
			own_bindings.size > 0
				? new Map([...outer_minus_shadow, ...own_bindings])
				: outer_minus_shadow;
		if (
			inner_bindings.size === 0 &&
			!params_changed &&
			!had_lazy_param &&
			!node.metadata?.has_lazy_descendants
		) {
			return node;
		}

		// Past the fast path: either we have active lazy bindings, lazy
		// params to replace, defaults referencing outer lazy, or the body
		// contains lazy descendants the BlockStatement handler will collect.
		// In every case the body needs to be walked.
		const new_body = apply_lazy_transforms_to_slot(node.body, inner_bindings);

		const final_params_src = params_changed ? new_params : node.params;
		const final_params = had_lazy_param ? replace_lazy_params(final_params_src) : final_params_src;

		if (new_body !== node.body || final_params !== node.params) {
			return rebuild(node, { params: final_params, body: new_body });
		}
		return node;
	}

	if (node.type === 'BlockStatement' || node.type === 'Program' || node.type === 'StaticBlock') {
		/** @type {AST.Program['body']} */
		const body = node.body;
		const block_bindings = collect_block_shadowed_names(body, lazy_bindings);
		const after_shadow =
			block_bindings.size > 0 ? remove_shadowed(lazy_bindings, block_bindings) : lazy_bindings;

		/** @type {Map<string, LazyBinding>} */
		const block_lazy = new Map();
		collect_lazy_bindings_from_statements(body, block_lazy);

		const initial_bindings =
			block_lazy.size > 0 ? new Map([...after_shadow, ...block_lazy]) : after_shadow;
		const transformed = transform_statement_list(
			node.body,
			initial_bindings,
			node.metadata?.has_lazy_var_loop_descendants === true,
		);
		return transformed.changed ? rebuild(node, { body: transformed.body }) : node;
	}

	if (node.type === 'CatchClause') {
		/** @type {Set<string>} */
		const shadowed = new Set();
		if (node.param) collect_shadowed_names(node.param, lazy_bindings, shadowed);
		const effective_bindings =
			shadowed.size > 0 ? remove_shadowed(lazy_bindings, shadowed) : lazy_bindings;
		const new_body = apply_lazy_transforms_to_slot(node.body, effective_bindings);
		if (new_body !== node.body) return rebuild(node, { body: new_body });
		return node;
	}

	if (node.type === 'DoWhileStatement') {
		const new_body = apply_lazy_transforms_to_slot(node.body, lazy_bindings);
		const test_bindings = advance_statement_var_loop_bindings(node.body, lazy_bindings);
		const new_test = apply_lazy_transforms_to_slot(node.test, test_bindings);
		if (new_body !== node.body || new_test !== node.test) {
			return rebuild(node, { body: new_body, test: new_test });
		}
		return node;
	}

	if (node.type === 'IfStatement') {
		const new_test = apply_lazy_transforms_to_slot(node.test, lazy_bindings);
		const new_consequent = apply_lazy_transforms_to_slot(node.consequent, lazy_bindings);
		const alternate_bindings = advance_statement_var_loop_bindings(node.consequent, lazy_bindings);
		const new_alternate =
			node.alternate && apply_lazy_transforms_to_slot(node.alternate, alternate_bindings);
		if (
			new_test !== node.test ||
			new_consequent !== node.consequent ||
			new_alternate !== node.alternate
		) {
			return rebuild(node, {
				test: new_test,
				consequent: new_consequent,
				alternate: new_alternate,
			});
		}
		return node;
	}

	if (node.type === 'TryStatement') {
		const new_block = apply_lazy_transforms_to_slot(node.block, lazy_bindings);
		const handler_bindings = advance_statement_var_loop_bindings(node.block, lazy_bindings);
		const new_handler =
			node.handler && apply_lazy_transforms_to_slot(node.handler, handler_bindings);
		const finalizer_bindings = node.handler
			? advance_statement_var_loop_bindings(node.handler, handler_bindings)
			: handler_bindings;
		const new_finalizer =
			node.finalizer && apply_lazy_transforms_to_slot(node.finalizer, finalizer_bindings);
		if (
			new_block !== node.block ||
			new_handler !== node.handler ||
			new_finalizer !== node.finalizer
		) {
			return rebuild(node, {
				block: new_block,
				handler: new_handler,
				finalizer: new_finalizer,
			});
		}
		return node;
	}

	if (node.type === 'ForStatement') {
		/** @type {Set<string>} */
		const shadowed = new Set();
		if (node.init?.type === 'VariableDeclaration') {
			for (const decl of node.init.declarations) {
				if (decl.id) collect_non_lazy_shadowed_names(decl.id, lazy_bindings, shadowed);
			}
		}
		let effective_bindings =
			shadowed.size > 0 ? remove_shadowed(lazy_bindings, shadowed) : lazy_bindings;
		let changed = false;
		let new_init = node.init;
		if (node.init?.type === 'VariableDeclaration') {
			const transformed = transform_classic_for_declaration(node.init, effective_bindings);
			new_init = transformed.declaration;
			effective_bindings = transformed.lazy_bindings;
		} else if (node.init) {
			new_init = apply_lazy_transforms_to_slot(node.init, effective_bindings);
		}
		if (new_init !== node.init) changed = true;
		const new_test = node.test && apply_lazy_transforms_to_slot(node.test, effective_bindings);
		if (new_test !== node.test) changed = true;
		const new_update =
			node.update && apply_lazy_transforms_to_slot(node.update, effective_bindings);
		if (new_update !== node.update) changed = true;
		const new_body = apply_lazy_transforms_to_slot(node.body, effective_bindings);
		if (new_body !== node.body) changed = true;
		return changed
			? rebuild(node, { init: new_init, test: new_test, update: new_update, body: new_body })
			: node;
	}

	if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
		/** @type {Set<string>} */
		const shadowed = new Set();
		if (node.left?.type === 'VariableDeclaration') {
			for (const decl of node.left.declarations) {
				if (decl.id) collect_shadowed_names(decl.id, lazy_bindings, shadowed);
			}
		} else {
			collect_shadowed_names(node.left, lazy_bindings, shadowed);
		}
		const after_shadow =
			shadowed.size > 0 ? remove_shadowed(lazy_bindings, shadowed) : lazy_bindings;
		const transformed_left = transform_for_each_left(node.left, after_shadow);
		const effective_bindings =
			transformed_left.lazy_bindings.size > 0
				? new Map([...after_shadow, ...transformed_left.lazy_bindings])
				: after_shadow;
		let changed = false;
		if (transformed_left.left !== node.left) changed = true;
		// The right-hand side is evaluated in the outer scope (before the loop
		// variable is bound), so use the unshadowed bindings there.
		const new_right = apply_lazy_transforms_to_slot(node.right, lazy_bindings);
		if (new_right !== node.right) changed = true;
		const new_body = apply_lazy_transforms_to_slot(node.body, effective_bindings);
		if (new_body !== node.body) changed = true;
		return changed
			? rebuild(node, { left: transformed_left.left, right: new_right, body: new_body })
			: node;
	}

	if (node.type === 'SwitchStatement') {
		// All case consequents share one lexical block scope, and `@switch`
		// case bodies are flattened (the `{ … }` wrapper is dropped), so a
		// `let &[x] = …` / `let &{ … } = …` declared in a case body is scoped to
		// the whole switch block. Collect names and lazy bindings across every
		// consequent — like the BlockStatement handler does for a block body — so
		// references in any case resolve to the generated id, and an inner
		// declaration shadowing an outer lazy name is dropped.
		const all_consequents = node.cases.flatMap((switch_case) => switch_case.consequent);
		const block_shadowed = collect_block_shadowed_names(all_consequents, lazy_bindings);
		const after_shadow =
			block_shadowed.size > 0 ? remove_shadowed(lazy_bindings, block_shadowed) : lazy_bindings;

		/** @type {Map<string, LazyBinding>} */
		const block_lazy = new Map();
		collect_lazy_bindings_from_statements(all_consequents, block_lazy);
		const effective_bindings =
			block_lazy.size > 0 ? new Map([...after_shadow, ...block_lazy]) : after_shadow;

		let changed = false;
		// The discriminant is evaluated before any case body runs, so it sees the
		// bindings visible at the switch (outer, minus inner shadows), not a lazy
		// binding declared inside a case body.
		const new_discriminant = apply_lazy_transforms_to_slot(node.discriminant, after_shadow);
		if (new_discriminant !== node.discriminant) changed = true;
		let consequent_bindings = effective_bindings;
		const new_cases = node.cases.map((switch_case) => {
			let case_changed = false;
			const new_test = switch_case.test
				? apply_lazy_transforms_to_slot(switch_case.test, effective_bindings)
				: null;
			if (new_test !== switch_case.test) case_changed = true;
			const transformed = transform_statement_list(
				switch_case.consequent,
				consequent_bindings,
				node.metadata?.has_lazy_var_loop_descendants === true,
			);
			consequent_bindings = transformed.lazy_bindings;
			if (transformed.changed) case_changed = true;
			if (case_changed) {
				changed = true;
				return rebuild(switch_case, { test: new_test, consequent: transformed.body });
			}
			return switch_case;
		});
		return changed ? rebuild(node, { discriminant: new_discriminant, cases: new_cases }) : node;
	}

	// Standalone lazy destructuring assignment: `&[data] = track(0);` becomes
	// `const __lazy0 = track(0);`. Individual name bindings are already in scope
	// via the enclosing BlockStatement handler.
	if (node.type === 'ExpressionStatement') {
		const assignment = get_standalone_assignment(node);
		const pattern = assignment?.left;
		if (
			assignment?.operator === '=' &&
			(pattern?.type === 'ObjectPattern' || pattern?.type === 'ArrayPattern') &&
			pattern.lazy
		) {
			const lazy_id_name = pattern.metadata?.lazy_id;
			if (lazy_id_name !== undefined) {
				const lazy_id = build_lazy_id_for_pattern(pattern, lazy_id_name, false);
				if (pattern.typeAnnotation) lazy_id.typeAnnotation = pattern.typeAnnotation;
				const init = apply_lazy_transforms_to_slot(assignment.right, lazy_bindings);
				return b.const(lazy_id, init);
			}
		}
	}

	// Non-lazy outer assignment whose LHS contains nested lazy patterns:
	// `{ pair: &[a, b] } = obj` → `{ pair: __lazy0 } = obj`. JS reference
	// semantics carry writes from `__lazy0[0] = x` back into `obj.pair[0]`.
	if (
		node.type === 'ExpressionStatement' &&
		node.expression?.type === 'AssignmentExpression' &&
		node.expression.operator === '=' &&
		(node.expression.left?.type === 'ObjectPattern' ||
			node.expression.left?.type === 'ArrayPattern') &&
		!node.expression.left.lazy
	) {
		const new_left = replace_lazy_in_pattern(node.expression.left);
		if (new_left !== node.expression.left) {
			return {
				...node,
				expression: {
					...node.expression,
					left: new_left,
					right: apply_lazy_transforms_to_slot(node.expression.right, lazy_bindings),
				},
			};
		}
	}

	// Diagnosed lazy assignments remain ordinary destructuring assignments in
	// best-effort output. Wrapping the recovery expression is valid in every
	// expression slot, including braceless statement bodies and nested
	// assignments where an object-pattern target would otherwise be ambiguous.
	// Supported standalone assignments have a preallocated ID and are handled
	// by the declaration branch above before traversal reaches this node.
	if (
		node.type === 'AssignmentExpression' &&
		node.operator === '=' &&
		(node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') &&
		node.left.lazy &&
		!node.left.metadata?.lazy_id
	) {
		const new_right = apply_lazy_transforms_to_slot(node.right, lazy_bindings);
		const recovered = new_right === node.right ? node : { ...node, right: new_right };
		return b.parenthesized(recovered, has_location(node) ? node : undefined);
	}

	// AssignmentExpression / UpdateExpression whose target is a lazy identifier.
	if (
		node.type === 'AssignmentExpression' &&
		node.left?.type === 'Identifier' &&
		lazy_bindings.has(node.left.name)
	) {
		const binding = /** @type {LazyBinding} */ (lazy_bindings.get(node.left.name));
		return {
			...node,
			left: binding.read(node.left),
			right: apply_lazy_transforms_to_slot(node.right, lazy_bindings),
		};
	}

	if (
		node.type === 'UpdateExpression' &&
		node.argument?.type === 'Identifier' &&
		lazy_bindings.has(node.argument.name)
	) {
		const binding = /** @type {LazyBinding} */ (lazy_bindings.get(node.argument.name));
		return { ...node, argument: binding.read(node.argument) };
	}

	// Replace lazy variable declaration patterns with generated identifiers.
	if (node.type === 'VariableDeclarator' && node.id?.metadata?.lazy_id) {
		const lazy_id = create_generated_identifier(node.id.metadata.lazy_id);
		if (node.id.typeAnnotation) lazy_id.typeAnnotation = node.id.typeAnnotation;
		return {
			...node,
			id: lazy_id,
			init: node.init && apply_lazy_transforms_to_slot(node.init, lazy_bindings),
		};
	}

	// Non-lazy outer declarator whose id contains nested lazy patterns:
	// `let { pair: &[a, b] } = data` → `let { pair: __lazy0 } = data`.
	if (
		node.type === 'VariableDeclarator' &&
		(node.id?.type === 'ObjectPattern' || node.id?.type === 'ArrayPattern') &&
		!node.id.lazy
	) {
		const new_id = replace_lazy_in_pattern(node.id);
		if (new_id !== node.id) {
			return {
				...node,
				id: new_id,
				init: node.init && apply_lazy_transforms_to_slot(node.init, lazy_bindings),
			};
		}
	}

	// Shorthand object properties `{ name }` → `{ name: __lazy0.name }`.
	if (node.type === 'Property' && node.shorthand && node.value?.type === 'Identifier') {
		const binding = lazy_bindings.get(node.value.name);
		if (binding) {
			return { ...node, shorthand: false, value: binding.read(node.value) };
		}
	}

	// Bare identifier reference.
	if (node.type === 'Identifier' && lazy_bindings.has(node.name)) {
		const binding = /** @type {LazyBinding} */ (lazy_bindings.get(node.name));
		return binding.read(node);
	}

	// JSXIdentifier is a label (component/element name), never a reference.
	if (node.type === 'JSXIdentifier') return node;

	let changed = false;
	const entries = /** @type {AST.TraversableAstNode} */ (node);
	/** @type {Record<string, unknown>} */
	const clone = { ...entries };
	for (const key of Object.keys(entries)) {
		if (key === 'loc' || key === 'start' || key === 'end' || key === 'metadata') continue;

		// Skip non-computed, non-shorthand property keys (they are labels).
		if (key === 'key' && node.type === 'Property' && !node.computed && !node.shorthand) continue;
		// Skip non-computed member expression property access.
		if (key === 'property' && node.type === 'MemberExpression' && !node.computed) continue;
		// Skip JSXMemberExpression property (label, not reference).
		if (key === 'property' && node.type === 'JSXMemberExpression') continue;
		// Skip JSXAttribute names (labels).
		if (key === 'name' && node.type === 'JSXAttribute') continue;
		// Skip VariableDeclarator id (already handled above).
		if (key === 'id' && node.type === 'VariableDeclarator') continue;

		// A JSX element/component name that resolves to a lazy binding becomes a
		// JSX member expression (`<Item>` → `<__lazy0.Item>`): the bound name is no
		// longer a local, it is a property of the synthesized lazy source.
		if (
			key === 'name' &&
			(node.type === 'JSXOpeningElement' || node.type === 'JSXClosingElement')
		) {
			const jsx_name = rewrite_lazy_jsx_name(node.name, lazy_bindings);
			if (jsx_name) {
				clone[key] = jsx_name;
				changed = true;
				continue;
			}
		}

		const new_value = apply_lazy_transforms_to_value(entries[key], lazy_bindings);
		if (new_value !== entries[key]) {
			clone[key] = new_value;
			changed = true;
		}
	}
	return changed ? /** @type {AST.Node} */ (clone) : node;
}

/**
 * @template {AST.Pattern} T
 * @param {T} param
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {T | AST.AssignmentPattern}
 */
function transform_param_defaults(param, lazy_bindings) {
	if (param.type === 'AssignmentPattern') {
		const new_right = apply_lazy_transforms_to_slot(param.right, lazy_bindings);
		if (new_right !== param.right) return { ...param, right: new_right };
	}
	return param;
}

/**
 * @param {AST.Node | null | undefined} pattern
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @param {Set<string>} shadowed
 */
function collect_shadowed_names(pattern, lazy_bindings, shadowed) {
	if (!pattern || typeof pattern !== 'object') return;
	if (pattern.type === 'Identifier' && lazy_bindings.has(pattern.name)) {
		shadowed.add(pattern.name);
		return;
	}
	if (pattern.type === 'AssignmentPattern') {
		collect_shadowed_names(pattern.left, lazy_bindings, shadowed);
		return;
	}
	if (pattern.type === 'RestElement') {
		collect_shadowed_names(pattern.argument, lazy_bindings, shadowed);
		return;
	}
	if (pattern.type === 'ObjectPattern') {
		for (const prop of pattern.properties) {
			if (prop.type === 'RestElement') {
				collect_shadowed_names(prop.argument, lazy_bindings, shadowed);
			} else {
				collect_shadowed_names(prop.value, lazy_bindings, shadowed);
			}
		}
		return;
	}
	if (pattern.type === 'ArrayPattern') {
		for (const element of pattern.elements) {
			if (element) collect_shadowed_names(element, lazy_bindings, shadowed);
		}
	}
}

/**
 * Collect only ordinary bindings from a declaration pattern. Lazy bindings
 * remain mapped while their own initializer runs and are installed afterward
 * by `transform_classic_for_declaration` in declarator source order.
 *
 * @param {AST.Node | null | undefined} pattern
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @param {Set<string>} shadowed
 */
function collect_non_lazy_shadowed_names(pattern, lazy_bindings, shadowed) {
	if (!pattern || typeof pattern !== 'object') return;
	if ((pattern.type === 'ObjectPattern' || pattern.type === 'ArrayPattern') && pattern.lazy) {
		return;
	}
	if (pattern.type === 'Identifier' && lazy_bindings.has(pattern.name)) {
		shadowed.add(pattern.name);
		return;
	}
	if (pattern.type === 'AssignmentPattern') {
		collect_non_lazy_shadowed_names(pattern.left, lazy_bindings, shadowed);
		return;
	}
	if (pattern.type === 'RestElement') {
		collect_non_lazy_shadowed_names(pattern.argument, lazy_bindings, shadowed);
		return;
	}
	if (pattern.type === 'ObjectPattern') {
		for (const prop of pattern.properties) {
			collect_non_lazy_shadowed_names(
				prop.type === 'RestElement' ? prop.argument : prop.value,
				lazy_bindings,
				shadowed,
			);
		}
		return;
	}
	if (pattern.type === 'ArrayPattern') {
		for (const element of pattern.elements) {
			if (element) collect_non_lazy_shadowed_names(element, lazy_bindings, shadowed);
		}
	}
}

/**
 * @param {AST.Program['body']} statements
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @returns {Set<string>}
 */
function collect_block_shadowed_names(statements, lazy_bindings) {
	/** @type {Set<string>} */
	const shadowed = new Set();
	for (const stmt of statements) {
		if (stmt.type === 'VariableDeclaration') {
			for (const decl of stmt.declarations) {
				if (decl.id.metadata?.lazy_id) continue;
				collect_shadowed_names(decl.id, lazy_bindings, shadowed);
			}
		} else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
			if (lazy_bindings.has(stmt.id.name)) shadowed.add(stmt.id.name);
		}
	}
	return shadowed;
}

/**
 * @param {Map<string, LazyBinding>} lazy_bindings
 * @param {Set<string>} shadowed
 * @returns {Map<string, LazyBinding>}
 */
function remove_shadowed(lazy_bindings, shadowed) {
	const result = new Map(lazy_bindings);
	for (const name of shadowed) result.delete(name);
	return result;
}

/**
 * Replace any lazy `&{}` / `&[]` patterns in a parameter list with their
 * generated lazy identifiers, including patterns nested inside non-lazy outer
 * patterns. For `({ pair: &[a, b] })` returns `({ pair: __lazy0 })`. Leaves
 * params without any lazy descendants untouched.
 *
 * @param {AST.Pattern[]} params
 * @returns {AST.Pattern[]}
 */
export function replace_lazy_params(params) {
	return params.map((param) => {
		if (param.type === 'AssignmentPattern') {
			const new_left = replace_lazy_in_pattern(param.left);
			return new_left === param.left ? param : { ...param, left: new_left };
		}
		return replace_lazy_in_pattern(param);
	});
}
