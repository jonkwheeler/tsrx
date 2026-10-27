---
'@tsrx/core': patch
---

TypeScript errors on an array literal or an empty type literal are now reported where they are written in `.tsrx` files. On TypeScript 7, TS2344 on the `{}` in `g<{}>()` landed one column early, on the `<`, and TS2322 on the `[]` in `[ {}, [] ] satisfies number[]` was reported at a generated position past the end of the file. `tsrx-tsc` and the TypeScript 5.9 plugin dropped the errors on an array inside an array, as in `[[]] satisfies number[]`. Array, object and type literals now map their start, their end and their brackets, so an error on a whole literal keeps both of its ends. An error after a comment inside an object literal, as in `{ /* c */ a: 1 as string }`, is also no longer reported on the comment by `tsrx-tsc` (#1209).
