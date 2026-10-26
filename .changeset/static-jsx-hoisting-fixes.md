---
'@tsrx/core': patch
---

Fixes two bugs in hoisting static JSX to module-level constants:

- JSX whose tag reads a binding the module has not initialized yet is no longer hoisted. This covers the class the JSX is in (`<Screen.Tag>` in a method of `class Screen`), a const or class declared later, and `this`. Importing such a module threw `Cannot access 'Screen' before initialization`. Tags that read imports or function declarations are still hoisted (#204).
- A raw `<script>` in an expression container or prop of static JSX keeps its body, as in `<div>{<script type="application/json">{"a":1}</script>}</div>`. The script rendered empty (#845).
