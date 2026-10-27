---
'@tsrx/solid': patch
'@tsrx/vue': patch
---

Solid now imports the components it generates for `@if`, `@for`, `@switch` and `@try` under private names (`__Show`, `__For`, `__Switch`, `__Match`, `__Errored`, `__Loading`), and Vue imports the `VaporFor` it generates for `@for` as `__VaporFor`. A module can declare its own binding with one of those names (an import from another module, a type-only import, a module or setup local, or a `@for (const Match of rows)` loop variable) without the build failing with "Identifier `Show` has already been declared", and the generated element no longer renders the authored binding in its place. An authored `import type { VaporFor } from 'vue-jsx-vapor'` now stays type-only beside the generated value imports. Vue's `defineVaporComponent` keeps its public name, because vue-jsx-vapor recognizes components by that name.
