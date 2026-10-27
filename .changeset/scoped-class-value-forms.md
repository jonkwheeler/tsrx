---
'@tsrx/core': patch
'@tsrx/runtime': patch
'@tsrx/react': patch
'@tsrx/preact': patch
'@tsrx/solid': patch
'@tsrx/vue': patch
'@tsrx/hono': patch
---

Scoped style classes now join an element's class the way its target renders that class. Beside a `<style>` block, `<div className={props.c} />` rendered `class="undefined tsrx-…"` when `c` was unset, and on Solid and Vue `class={{ active: on }}` rendered `[object Object] tsrx-…` and `class={['a', on && 'b']}` rendered `a,false tsrx-…`.

- React, Preact and Hono join the class through the runtime's new `join_scope_class`, which leaves out a `null`, `undefined` or `false` class and joins any other value as text, as these targets render it.
- Solid and Vue, whose `class` also takes an object or a list, get `class={[value, 'tsrx-…']}`.
- A class that is always a string (a template literal, a choice between string literals, a `$class` read) still joins as text, and the editor's type-only output is unchanged.
