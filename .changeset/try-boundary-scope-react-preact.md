---
'@tsrx/core': patch
'@tsrx/react': patch
'@tsrx/preact': patch
'@tsrx/react-runtime': patch
'@tsrx/preact-runtime': patch
---

On React and Preact, a `@try` body's setup statements now run inside its
boundary, as they already do on Solid and Vue. A synchronous throw in the body,
such as `const data = load();`, renders the `@catch` fallback instead of escaping
the boundary, and `use(promise)` called in the body shows the `@pending` fallback
instead of leaving the root blank
([#510](https://github.com/tsrx-org/tsrx/issues/510)). The compiled body renders
through a new `TsrxTryBody` component exported from the `error-boundary` runtime
modules. A body that uses `await` or `yield` still runs inline in the enclosing
function, which has to settle it.

`@catch` now also catches a thrown `null` on React and Preact
([#847](https://github.com/tsrx-org/tsrx/issues/847)). Preact itself turns a
`null` or `undefined` thrown while rendering into a `TypeError`, so on Preact the
value arrives unchanged only when it is thrown from an effect.
