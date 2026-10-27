---
'@tsrx/core': patch
'@tsrx/runtime': patch
'@tsrx/react': patch
'@tsrx/preact': patch
'@tsrx/hono': patch
---

On React, Preact, and Hono, an element with its own `ref` and a host spread no
longer detaches and reattaches its refs on every render. In
`<input ref={log} {...props.rest} />`, every update called `log` with `null` and
then with the element again, because the merged `ref` was a new callback each
time. The merge now calls the runtime's new `merge_element_refs`, which returns
a single ref as itself and the same callback for the same refs, so a ref is
applied again only when one of the refs changes, as in plain TSX.

A `ref` written before a spread is still evaluated where it is written: it is
assigned to a binding there, and the merged `ref` follows the spreads. A custom
platform with `jsx.hostSpreadRefBinding: 'in-place'` now imports
`merge_element_refs` from its `imports.mergeRefs` module. `@tsrx/runtime/ref`
and every first-party `*/ref` module export it.
