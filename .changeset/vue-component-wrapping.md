---
'@tsrx/vue': patch
'@tsrx/core': patch
---

More Vue components are now wrapped in `defineVaporComponent`, and wrapped components can be read above their declaration:

- An arrow component that contains a nested function, such as an inline `onClick={() => …}` handler or a `.map()` callback, is now wrapped. Before, it stayed a plain function, and mounting it as the app root threw `Cannot read properties of undefined (reading 'config')`.
- A component that builds its JSX in a local variable and returns it (`const element = <div />; return element;`) is now wrapped. Before, its props never reached it and mounting it as the app root threw. A local binding counts when it holds JSX anywhere, the same rule already used for a returned expression, so a `function Config() { const c = { icon: <i /> }; return c; }` is wrapped just as `function Columns() { return [{ header: <b /> }]; }` already was.
- A default-exported component (`export default function Card`) now compiles to `const Card = defineVaporComponent(…); export default Card;`, so the module keeps its `Card` binding. Before, one with a nested function compiled to the invalid `export default const …`, and `typeof Card` or `export { Card }` lost the binding.
- A component read above its declaration while the module loads, as in `export const registry = { inner: Inner }` before `function Inner`, now loads: the compiler moves the wrapped `const` above that read when doing so changes nothing else. When the component's destructured prop defaults read a binding it would move past (vue-jsx-vapor evaluates `{ label = PREFIX }` when the component is defined), the compiler reports the new TSRX2028 at the read and asks you to move the declaration up instead. Reads that do not run at load (in a function, a class instance field, a branch a constant condition skips, or a scope with its own binding of the name) move nothing. Reads through a call or IIFE, from another `case` of the declaring `switch`, or through a circular import cannot be seen and still hit the constant before it is initialized.
