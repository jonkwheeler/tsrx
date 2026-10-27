---
'@tsrx/core': patch
---

On Solid, Vue and Hono DOM, whose components can't be async, an `await` anywhere in a component body is now reported as TSRX2021. Before, an `await` in an attribute of the component's root element, in an `if` test, in a `switch` discriminant or case test, or in a `catch` parameter default, and an `await using` declaration, compiled to an async component with no error. On Hono DOM, a module that also renders the component got no error in the editor either. The errors for a component now come in source order, so strict mode throws at the first `await`. React, Preact and Hono server accept async components and are unchanged. `findFirstTopLevelAwait` now also returns an `await using` declaration.
