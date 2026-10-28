---
'@tsrx/core': patch
---

On Vue, the helper component that renders a `@catch` body under `@pending` is declared once beside its component, in the enclosing function or namespace body, when the component is inside another function or a namespace and the helper reads nothing from the component's scope (only its own `@catch` parameter, its own locals and bindings outside the component). Before, it was declared in the component's setup, so every instance defined a new helper component. A helper that reads a binding of the component's scope stays in the setup.
