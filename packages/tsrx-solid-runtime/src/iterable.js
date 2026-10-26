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

/**
 * The `each` of the `<For>` an `@for` becomes when its key reads the loop
 * index, which Solid's `keyed` callback doesn't receive: each item paired with
 * its key, computed from the item and its index.
 *
 * @template T
 * @template K
 * @param {Iterable<T> | Iterator<T> | null | undefined | false} source
 * @param {(item: T, index: number) => K} key
 * @returns {Array<{ item: T, key: K }> | null | undefined | false}
 */
export function for_keyed_rows(source, key) {
	if (source == null || source === false) {
		return source;
	}
	return iterable_to_array(source).map((item, index) => ({ item, key: key(item, index) }));
}
