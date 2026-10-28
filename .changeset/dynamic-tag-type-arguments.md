---
'@tsrx/core': patch
'@tsrx/prettier-plugin': patch
---

Type arguments after a dynamic tag, as in `<{Tag}<T> />`, now parse and report TSRX2033, which says to declare a typed alias above the element: `const Typed = Tag<T>;`, then `<{Typed} />`. They used to fail with "Unexpected token", except inside an element's `{ }`, where they parsed and the editor's code passed them to the dynamic helper, so they typed the tag instead of its props. Collect mode and the editor record the error and leave the type arguments out of the generated code. The Prettier plugin reports the error instead of formatting the file, as it does for TSRX2014.
