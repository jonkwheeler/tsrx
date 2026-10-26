---
'@tsrx/core': patch
'@tsrx/solid': patch
---

On Solid, a host element with one spread and its own `ref` now behaves as it
does in plain Solid TSX:

- `ref={el}` assigns the element to `el`. Before, the compiler put the ref in
  an array with the spread's ref, and Solid only calls the functions in an
  array, so `el` stayed `undefined`.
- A `ref` inside the spread is called once. Before, it was called twice
  (`bag`, `own`, `bag`): once through the element's ref array and again by
  Solid's `spread()`.
- The spread updates when its expression changes, as in
  `<button {...bag()} ref={cb} />`. Before, the bag was read once in a setup
  declaration, so its attributes kept their first values.

The element now keeps its `ref` as written and spreads the normalized bag in
place, so Solid's `spread()` applies the bag's `ref` itself. Solid keeps only
the last of several spreads' refs, so an element with more than one spread and
its own `ref` still merges every spread's ref into the element's ref array.
The new `jsx.hostSpreadRefStrategy: 'spread'` platform option selects this
lowering.
