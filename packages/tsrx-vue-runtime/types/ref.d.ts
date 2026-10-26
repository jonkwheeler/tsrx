import type { ComponentPublicInstance } from 'vue';
import type { MergeableRef } from '@tsrx/runtime/ref';

export * from '@tsrx/runtime/ref';

/**
 * Vue types a `ref` callback as receiving an element, a component instance or
 * `null` (`VNodeRef`), so the merged callback accepts all three. With the
 * shared `(node: T | null) => …` signature, `ref={mergeRefs(a, b)}` and the
 * compiler's merged spread ref fail to type-check against `VNodeRef`.
 */
export function mergeRefs<T = Element>(
	...refs: Array<MergeableRef<T>>
): (node: T | Element | ComponentPublicInstance | null) => () => void;
