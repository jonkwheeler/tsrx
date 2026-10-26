---
'@tsrx/runtime': patch
---

`@for` on React, Preact, and Hono now walks its source the way `for...of` does. An array with its own `Symbol.iterator`, including an array subclass that overrides it, renders the items its iterator yields instead of its indexed items, and an empty array whose iterator yields items no longer renders `@empty`. A `Symbol.iterator` getter is read once instead of twice.
