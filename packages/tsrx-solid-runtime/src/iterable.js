import { iterable_to_array } from '@tsrx/runtime/iterable';

/**
 * The `each` of the `<For>` an `@for` becomes: the source's items as an array,
 * walked the way `for...of` walks them. A missing source stays as it is, so
 * `<For>` renders its fallback.
 *
 * @template T
 * @param {Iterable<T> | Iterator<T> | null | undefined | false} source
 * @returns {T[] | null | undefined | false}
 */
export function for_items(source) {
	return source == null || source === false ? source : iterable_to_array(source);
}
