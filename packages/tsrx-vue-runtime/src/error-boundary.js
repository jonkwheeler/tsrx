/** @import { ComponentInternalInstance, ShallowRef } from 'vue' */
/** @import { TsrxErrorBoundaryProps } from '../types/error-boundary' */
/** @import { VaporBlock, VaporFragment, VaporRenderedBlock, VaporRuntime } from '../types/vapor-runtime' */

import * as Vue from 'vue';
import { EffectScope, getCurrentInstance, onErrorCaptured, shallowRef } from 'vue';

/**
 * The Vapor renderer's fragment/component helpers are runtime-internal, so
 * `vue`'s published types don't describe them and there is no upstream
 * declaration to widen. Narrow the namespace object once here; every use below
 * is checked against {@link VaporRuntime}.
 */
const vapor = /** @type {VaporRuntime} */ (/** @type {unknown} */ (Vue));

/** @typedef {{ error: ShallowRef<unknown>, reset: () => void }} BoundaryState */

/** @typedef {{ asyncDep?: Promise<unknown> | null, asyncResolved?: boolean }} AsyncSetupState */

/** @type {WeakMap<ComponentInternalInstance, BoundaryState>} */
const boundary_states = new WeakMap();

/**
 * The errors captured for each boundary that is rendering its content right
 * now, innermost last. An error thrown while a boundary renders belongs to the
 * innermost one, whichever component's `onErrorCaptured` hook sees it first.
 *
 * @type {unknown[][]}
 */
const rendering = [];

/**
 * The instance of a boundary rendered as a component. Vapor calls a
 * component's setup with its instance as the second argument. Compiled output
 * also calls `TsrxErrorBoundary` as a plain function inside element children;
 * that call runs under the enclosing component's instance and must not take
 * over its state. `getCurrentInstance()` returns null for a Vapor instance.
 *
 * @param {unknown} ctx
 * @returns {ComponentInternalInstance | null}
 */
function own_instance(ctx) {
	const instance = vapor.currentInstance ?? getCurrentInstance();
	return instance && ctx === instance ? instance : null;
}

/**
 * @param {VaporBlock} nodes
 * @param {Node} [anchor]
 * @returns {VaporFragment}
 */
function create_fragment(nodes, anchor = document.createTextNode('')) {
	const fragment = new vapor.VaporFragment(nodes);
	fragment.anchor = anchor;
	return fragment;
}

/**
 * @param {Record<string, unknown> | null | undefined} value
 * @returns {void}
 */
function track_dynamic_values(value) {
	if (!value || typeof value !== 'object') return;

	for (const key of Object.keys(value)) {
		const child = value[key];
		if (key === 'content' || key === 'fallback' || key === 'children' || key === 'default')
			continue;
		if (key === '$' || key.startsWith('on')) continue;
		if (typeof child === 'function') {
			child();
		}
	}
}

/**
 * @param {unknown} node
 * @param {Node | undefined} anchor
 * @returns {VaporRenderedBlock}
 */
function normalize_block(node, anchor) {
	if (node instanceof Node || vapor.isFragment(node)) return node;
	if (vapor.isVaporComponent(node)) {
		if (!(node.rawProps && 'content' in node.rawProps && 'fallback' in node.rawProps)) {
			track_dynamic_values(node.rawProps);
		}
		return create_fragment(node, anchor);
	}
	if (Array.isArray(node))
		return create_fragment(
			node.map((item) => normalize_block(item, undefined)),
			anchor,
		);

	const result = node == null || typeof node === 'boolean' ? '' : String(node);
	if (anchor) {
		anchor.textContent = result;
		return anchor;
	}
	return document.createTextNode(result);
}

/**
 * @param {VaporRenderedBlock | undefined} current
 * @param {unknown} value
 * @param {Node | undefined} anchor
 * @returns {VaporRenderedBlock}
 */
function resolve_value(current, value, anchor) {
	anchor = anchor || (current instanceof Node && current.nodeType === 3 ? current : undefined);
	const node = normalize_block(value, anchor);

	if (current) {
		if (vapor.isFragment(current)) {
			if (current.anchor && current.anchor.parentNode) {
				vapor.remove(current.nodes, current.anchor.parentNode);
				vapor.insert(node, current.anchor.parentNode, current.anchor);
				if (current.scope) current.scope.stop();
			}
		} else if (current instanceof Node) {
			if (current.nodeType === 3 && (!(node instanceof Node) || node.nodeType !== 3)) {
				current.textContent = '';
			}
			if (vapor.isFragment(node) && current.parentNode) {
				vapor.insert(node, current.parentNode, current);
				if (current.nodeType !== 3) current.parentNode.removeChild(current);
			} else if (node instanceof Node) {
				if (current.nodeType === 3 && node.nodeType === 3) {
					current.textContent = node.textContent;
					return current;
				}
				if (current.parentNode) current.parentNode.replaceChild(node, current);
			}
		}
	}

	return node;
}

/**
 * @param {() => unknown} render
 * @returns {Array<VaporRenderedBlock | undefined>}
 */
function create_boundary_nodes(render) {
	/** @type {Array<VaporRenderedBlock | undefined>} */
	const nodes = [];
	/** @type {EffectScope | undefined} */
	let scope;

	vapor.renderEffect(() => {
		if (scope) scope.stop();
		scope = new EffectScope();
		nodes[0] = scope.run(() => resolve_value(nodes[0], render(), undefined));
	});

	return nodes;
}

/**
 * A reusable Vue error boundary component.
 *
 * Used by the `@tsrx/vue` compiler to implement `try/catch` blocks.
 * The `fallback` prop receives the caught error and a `reset` function
 * that clears the error state to re-render the children.
 *
 * @param {TsrxErrorBoundaryProps} props
 * @param {unknown} [ctx] the instance, when Vapor renders it as a component
 * @returns {Array<VaporRenderedBlock | undefined>}
 */
export function TsrxErrorBoundary(props, ctx) {
	const instance = own_instance(ctx);
	if (instance) {
		initialize_boundary_state(instance);
	}
	const state = instance ? boundary_states.get(instance) : undefined;
	const error = state?.error ?? shallowRef(/** @type {unknown} */ (null));
	const reset =
		state?.reset ??
		(() => {
			error.value = null;
		});

	return create_boundary_nodes(() => {
		if (error.value !== null) {
			return props.fallback(error.value, reset);
		}

		/** @type {unknown[]} */
		const captured = [];
		/** @type {unknown} */
		let content;
		rendering.push(captured);
		try {
			content = props.content();
		} catch (caught_error) {
			captured.push(caught_error);
		} finally {
			rendering.pop();
		}
		if (captured.length > 0) {
			error.value = captured[0];
			return props.fallback(captured[0], reset);
		}
		return content;
	});
}

/**
 * @param {unknown} _props
 * @param {unknown} [ctx]
 * @returns {void}
 */
TsrxErrorBoundary.__setup = function setup(_props, ctx) {
	const instance = own_instance(ctx);
	if (instance) {
		initialize_boundary_state(instance);
	}
};

/**
 * @param {ComponentInternalInstance} instance
 * @returns {void}
 */
function initialize_boundary_state(instance) {
	if (!instance || boundary_states.has(instance)) {
		return;
	}

	const error = shallowRef(/** @type {unknown} */ (null));
	const reset = () => {
		error.value = null;
	};

	boundary_states.set(instance, { error, reset });

	onErrorCaptured((captured_error, source) => {
		const active = rendering[rendering.length - 1];
		if (active) {
			active.push(captured_error);
			return false;
		}
		// Thrown after the content rendered. An async component whose loader
		// rejected still has its setup pending, and Vapor cannot unmount it
		// until its Suspense has mounted it, so swap in the fallback after that.
		const show = () => {
			error.value = captured_error;
		};
		const pending = /** @type {AsyncSetupState | null} */ (source);
		if (pending?.asyncDep && !pending.asyncResolved) {
			pending.asyncDep.then(show, show);
		} else {
			show();
		}
		return false;
	});
}
