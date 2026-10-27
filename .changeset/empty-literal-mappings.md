---
'@tsrx/core': patch
---

TypeScript errors on an array literal or an empty type literal are now reported where they are written in `.tsrx` files. On TypeScript 7, TS2344 on the `{}` in `g<{}>()` landed one column early, on the `<`, and TS2322 on the `[]` in `[ {}, [] ] satisfies number[]` was reported at a generated position past the end of the file. `tsrx-tsc` and the TypeScript 5.9 plugin dropped the errors on an array inside an array, as in `[[]] satisfies number[]`. Type literals and array literals now map as a whole, like object literals (#1209).
