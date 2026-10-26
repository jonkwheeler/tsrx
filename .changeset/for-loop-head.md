---
'@tsrx/core': patch
---

An `@for` head that assigns to an existing variable or property, as in `@for (state.item of items)` or `@for (item of items)`, is now reported as TSRX2027 on every target instead of compiling to invalid output or to a callback parameter that shadows the variable. A `using` or `await using` loop variable is reported the same way instead of losing its disposal.
