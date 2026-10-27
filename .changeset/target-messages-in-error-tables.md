---
'@tsrx/core': patch
'@tsrx/hono': patch
'@tsrx/solid': patch
---

The last target error messages written outside the error tables now come from `@tsrx/core/diagnostics`, with their codes unchanged. Hono DOM's error for an async component it renders is the new `HONO_DOM_ASYNC_COMPONENT_UNSUPPORTED` entry, and now formats `use(promise)` and `<Suspense>` as code. Hono's error for `@catch (error, reset)` is the new `TARGET_CATCH_RESET_UNSUPPORTED` entry (TSRX2026). Solid's errors for a JavaScript `try`/`finally` that throws in a component body raise core's `TEMPLATE_TRY_FINALLY` and `TEMPLATE_TRY_HANDLER` entries, so their wording follows core's: `` Solid TSRX does not support JavaScript `try/finally` in TSRX templates. … `` (was "in component templates") and `` TSRX try statements must have a `pending` or `catch` block. `` (was "Solid try statements …").
