---
'@tsrx/core': patch
'@tsrx/vue': patch
---

A keyed Vue `@for` whose item is an array pattern, as in `@for (const [first, second] of rows; key first)`, now destructures each item through its iterator, the way `for...of` does, instead of reading `item[0]` and `item[1]`. A `Set`, a string with astral characters, or any other iterable item now renders its real values, defaults in the pattern work, and the loop stays on `<VaporFor>`, so keyed rows keep their state and still update in place.

A keyed Vue `@for` no longer rewrites type parameters and type references that share the loop variable's name, so `function <item>(x: item) {}` in the loop body stays valid instead of becoming `function <item.value>(x: item.value)` and failing the build.
