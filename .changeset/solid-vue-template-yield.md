---
'@tsrx/core': patch
'@tsrx/solid': patch
'@tsrx/vue': patch
---

On Solid and Vue, a `yield` in a template is now a TSRX compile error, TSRX2034, at the authored `yield`: `` Solid TSRX does not support `yield` in a template: Solid evaluates template expressions in reactive effects, which cannot yield from the enclosing generator. … `` (and the same for Vue). That covers attribute values, children, spread values, component props, `@if`, `@for` and `@switch` heads, and `@if` or `@switch` bodies, including `yield*`. Before, the build failed later in `babel-preset-solid` or `vue-jsx-vapor` output, with `A 'yield' expression is only allowed in a generator body.` or `The keyword 'yield' is reserved` pointing at compiled code. A `yield` in a nested generator function, in the setup statements of a function's own `@{ … }` body, or before the element is still allowed, so yield the value first: `const title = yield bag.title;`. A `yield` in an `@for` body is now reported as TSRX2034 rather than TSRX2022 on these targets. React, Preact and Hono evaluate templates eagerly and are unchanged.
