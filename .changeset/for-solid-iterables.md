---
'@tsrx/core': patch
'@tsrx/runtime': patch
'@tsrx/solid': patch
'@tsrx/solid-runtime': patch
---

`@for` on Solid now accepts any iterable, as on React, Preact, and Hono. A `Set`, a `Map` iterator, a generator, or an array with its own iterator no longer throws `newItems.slice is not a function` and halts Solid's reactivity; the loop walks the source once, the way `for...of` does, and hands `<For>` the resulting array. Arrays with the built-in iterator, including store arrays, reach `<For>` as they are. The helper comes from the new `@tsrx/solid/iterable` and `@tsrx/solid-runtime/iterable` subpaths, which re-export `iterable_to_array` from `@tsrx/runtime/iterable`.

A Solid `@for` whose key reads its declared index, as in `@for (const item of items(); index i; key i)`, no longer throws `ReferenceError: i is not defined` when the list updates. Solid's `keyed` callback receives the item alone, so such a loop now computes each key from the item and its index up front and renders those rows.
