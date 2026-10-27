---
'@tsrx/core': patch
'@tsrx/hono': patch
'@tsrx/vue': patch
---

The compiler now imports the components it generates for `@try … @pending`, `@try … @catch` and keyed fragment rows under private names (`__Suspense`, `__TsrxErrorBoundary`, `__Fragment`). A module can declare its own `Suspense`, `TsrxErrorBoundary` or `Fragment` (a type-only import, an import from another module, a local, or a `@for` loop variable) without the build failing with "Identifier `Suspense` has already been declared", and the generated element no longer renders the authored binding in its place.
