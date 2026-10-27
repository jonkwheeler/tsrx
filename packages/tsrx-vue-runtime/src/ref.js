import { mergeRefs as merge_refs } from '@tsrx/runtime/ref';

export * from '@tsrx/runtime/ref';

/**
 * The shared `mergeRefs`, adapted to how Vue calls a function ref: with the
 * node when it sets the ref and with `null` when it unsets it, ignoring what
 * the callback returns. The cleanup a merged ref returns when it is set (which
 * runs each callback's own cleanup, or calls it with `null`, and clears ref
 * objects) runs on that `null` call instead.
 *
 * @template T
 * @param {...import('@tsrx/runtime/ref').MergeableRef<T>} refs
 * @returns {(node: T | null) => () => void}
 */
export function mergeRefs(...refs) {
	const merged = merge_refs(...refs);
	/** @type {(() => void) | undefined} */
	let cleanup;
	const run_cleanup = () => {
		const pending = cleanup;
		cleanup = undefined;
		pending?.();
	};
	return (node) => {
		run_cleanup();
		if (node == null) return () => {};
		cleanup = merged(node);
		return run_cleanup;
	};
}
