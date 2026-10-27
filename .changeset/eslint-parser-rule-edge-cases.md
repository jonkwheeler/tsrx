---
'@tsrx/eslint-parser': patch
---

ESLint's `max-params` no longer crashes on a `.tsrx` file with a TypeScript function type, such as a prop typed `onPress?: () => void`, and `indent` no longer crashes on a `{name}` shorthand attribute ([#1153](https://github.com/tsrx-org/tsrx/issues/1153)). Function types and signatures now carry the `params` field that typescript-eslint gives them, and a shorthand attribute reaches ESLint as a `JSXShorthandAttribute` node, so rules written for `JSXAttribute` no longer look for an `=` it does not have.

A `@for` loop with a `var` head, or a head that declares nothing, now has its own scope, as a `const` or `let` loop does ([#1154](https://github.com/tsrx-org/tsrx/issues/1154)). `no-redeclare` no longer reports the same `index` name in two such loops, and `no-undef` reports the loop variable or index when the `@empty` branch uses it. The loop's `loc` is also right in files with CR or U+2028 line breaks.
