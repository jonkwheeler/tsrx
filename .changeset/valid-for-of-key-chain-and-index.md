---
'@tsrx/eslint-plugin': patch
---

`tsrx/valid-for-of-key` accepts a loop's declared `index` as its key (`@for (const item of items; index i; key i)`) instead of reporting `Variable 'i' is not defined` ([#559](https://github.com/tsrx-org/tsrx/issues/559)). It also reports an undeclared variable inside an optional chain, a non-null assertion, an `as` or `satisfies` expression, a spread, a sequence, `new`, or `await` in the key, such as `key missing?.id` ([#860](https://github.com/tsrx-org/tsrx/issues/860)).
