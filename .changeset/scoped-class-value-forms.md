---
'@tsrx/core': patch
'@tsrx/runtime': patch
'@tsrx/react': patch
'@tsrx/preact': patch
'@tsrx/solid': patch
'@tsrx/vue': patch
'@tsrx/hono': patch
---

Scoped style classes now join an element's class the way its target renders that class. Beside a `<style>` block, `<div className={props.c} />` rendered `class="undefined tsrx-…"` when `c` was unset, and on Solid and Vue `class={{ active: on }}` rendered `[object Object] tsrx-…` and `class={['a', on && 'b']}` rendered `a,false tsrx-…`. A class that may not be a string now joins through the runtime's new `join_scope_class`, which follows the target's rendering, set by the new `jsx.classValue` platform option:

- React and Hono DOM leave out `null`, `undefined`, `true` and `false`, Preact renders `true` as text, and Hono's server renders `true` and `false` as text. Any other value joins as text.
- Solid and Vue keep an object or a list class, and leave out other values that are not strings, such as numbers and functions. A props spread's class on Solid follows the same rule.
- A class that is always a string (a template literal, a choice between string literals, a `$class` read) still joins as text, and the editor's type-only output is unchanged.

On Solid and Vue, an authored `className` attribute on a host element now compiles to `class`, joined with any `class` attribute, so React-style source keeps its class with or without scoped styles. Solid ignored `className`, and Vue rendered a static one as a `classname` attribute. Component props, spread bags and the editor's type-only output keep `className` as written.
