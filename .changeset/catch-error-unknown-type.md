---
'@tsrx/react-runtime': patch
'@tsrx/preact-runtime': patch
'@tsrx/hono': patch
---

On React, Preact and Hono, the editor now types the `@catch` binding as
`unknown` instead of `Error`, as Vue already does
([#1076](https://github.com/tsrx-org/tsrx/issues/1076)). The binding is the
thrown value as it is, which can be a string, `null` or anything else, so
`error.message` is now reported (TS18046) until the value is checked, for
example with `error instanceof Error ? error.message : String(error)`. On Hono,
`@tsrx/hono/error-boundary` and `@tsrx/hono/dom/error-boundary` now declare
their own `TsrxErrorBoundary` type over Hono's `ErrorBoundary`, whose
`fallbackRender` is typed `(error: Error)`.
