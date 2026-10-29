---
'@tsrx/core': minor
---

Five TypeScript-coded errors that no source reached now either match what TypeScript reports or are gone:

- `TS_ERRORS.DECLARED_IN_SCOPE` is removed, and `createScopes` no longer reports a name declared twice in one scope. The parser reports those with TypeScript's codes, and the scope check also fired on code TypeScript accepts, such as `var a; var a;`. The one case only it caught, a parameter that a `let` or `const` in a `@{ … }` body redeclares, is now TS2300 from the parser, as in a `{ … }` body.
- `TS_ERRORS.SIGNATURE_PARAMETER_NAME` is removed: a signature's parameters read as nothing it could report. A hole in them (`type F = (a, , b) => void`) is now an unexpected `,` (TS1012), as in a function's parameters, where it used to crash. A default in a signature without a body (`declare function f(a = 1): void;`, an overload, an abstract method) is TS2371, as in a function type.
- `TS_ERRORS.JSX_UNESCAPED_GREATER_THAN` (TS1382) is removed: a `>` in JSX text is text in TSRX, now in the JSX of a dynamic tag's expression too.
- `TS_ERRORS.UNTERMINATED_JSX_CONTENTS` (TS17008) is removed: an element left open at the end of the input is TSRX1001, as in a template, in an attribute's JSX and in a dynamic tag's expression too.
- `TS_ERRORS.JSX_UNESCAPED_CLOSING_BRACE` (TS1381) stays, for a `}` in the text of the JSX in a dynamic tag's expression, as TypeScript reports it for JSX text.
