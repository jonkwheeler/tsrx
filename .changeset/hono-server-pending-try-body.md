---
'@tsrx/hono': patch
---

With Hono's server compiler (`@tsrx/hono`, `tsrxHono({ mode: 'server' })`), a `@pending` body now runs only while the `@try` body suspends, and a throw in it reaches `@catch` (#1310). It renders as a `TsrxTryBody` fallback, as on React and Preact. Before, it ran in the parent's render every time, even when nothing suspended, and a throw in it skipped the same `@try`'s `@catch`: it failed the render, unless an enclosing `@catch` caught it. Hook calls in the body, such as `useContext`, now run in `TsrxTryBody`, so they see providers that the same component renders around the `@try`. A body that uses `await` stays inline. The DOM compiler (`@tsrx/hono/dom`) is unchanged: Hono's DOM renderer can't render a `Suspense` fallback component that throws, so there the body still runs on every render.
