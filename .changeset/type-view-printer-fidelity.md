---
'@tsrx/core': patch
---

Compiled output and the editor's type view now keep more of a `.tsrx` file as written:

- An array pattern's type annotation prints once. With esrap 2.4, `function f([a]: number[]) {}` compiled to `function f([a]: number[]: number[]) {}`, which does not parse.
- An optional binding pattern parameter keeps its `?`, as in `declare function f({ a }?: T): void`. Calling `f()` no longer reports TS2554 (#556).
- A string statement that is not a directive keeps its parentheses, so `('use strict');` no longer compiles to a `'use strict'` directive (#968).
- Block-form `/* @ts-expect-error */` and `/* @ts-ignore */` directives now apply in `tsrx-tsc` and the editor, as in TypeScript (#866).
- Block comments print as written. A JSDoc comment no longer gets an extra space after `/**`, and one over several lines keeps its closing line (#1065).
