---
'@tsrx/core': patch
'@tsrx/prettier-plugin': patch
---

More parse errors now have the code and position TypeScript reports for the same source, instead of the code TSRX read from acorn's message:

- A missing `;` after a statement (`x = 1 2;`, `import "m" x;`) is TS1005 `';' expected.`, and `',' expected.` after a variable declaration's declarator, instead of TS1012 `Unexpected token`. After a lone name (`a b;`) it's TS1434 `Unexpected keyword or identifier.` at the name, or TS1435 with the keyword TypeScript takes it for (`cosnt x = 1;`).
- A word reserved in strict mode used as a name (`let`, `interface`, `public`, `static`, `yield`, …) is TS1214, or TS1213 inside a class, instead of TS1212. Collecting parses (the editor and the formatter) now record it and keep parsing for every such word, not only `let`, so the formatter formats `class public {}` as Prettier does. A `let` or `const` declaration named `let` also reports TS2480.
- A parameter after a rest parameter is TS1014 at the `...`, and an element after a rest element of a destructuring pattern TS2462, instead of TS1013 at the comma. TS1013 stays for a trailing comma.
- A call of `import.<name>` (`import.foo()`) is TS18061; without a call it stays TS17012. The formatter refuses both, as Prettier does.
- Type arguments after `?.` with no call (`` a?.<T>`c` ``) report TS1358 or TS1005 `'(' expected.` at the token after them, where the error said `Unexpected token (1:NaN)`.
