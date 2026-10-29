---
'@tsrx/core': patch
---

More checker errors now match what TypeScript reports, in the same order, in strict, collecting and loose parses:

- `declare` on a declaration in a block (`function f() { declare const x: number; }`, `if (a) declare const x: number;`) is TS1184 `Modifiers cannot appear here.` at `declare`, as `export` already was.
- A name bound twice in a signature without a body is TS2300 at each binding: in a `declare function`, an overload, an abstract or ambient method or constructor, an interface's or a type literal's members, and a function or constructor type (`type F = (a, a) => void`).
- A strict parse throws the error that a collecting parse records first in more code. A comma after a rest parameter (`m(public x, ...z,)`) is TS1013 after the TS2369 before it. A generic arrow function's parameters (`<T,>(...a, b) => a`, `async <T,>(...a,) => a`) give TS1014, TS1013 or TS2462 instead of an error at the `<` or after the arrow function, and still read `async <T>(...a, b)` as a call. In a `.mts` file, a collecting parse keeps the checker errors in an arrow function that acorn-typescript abandons, and a strict parse throws the first by position. The errors of a rest parameter property, or of a parameter property on a constructor without a body, come by position with the duplicate names around them.
- At one position, TS1187 for a parameter property with a binding pattern now comes before TS2369, as TypeScript sorts them by code.
