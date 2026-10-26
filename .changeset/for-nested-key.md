---
'@tsrx/core': patch
---

A keyed `@for` whose body is another `@for`, directly or inside an `@if` or `@switch` branch, now keys each iteration on React, Preact, and Hono. The inner loop's rows render in a `<Fragment>` with the outer key, so reordering the outer list moves each group's rows, and their state, with it instead of matching them up by position.
