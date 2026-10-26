---
'@tsrx/vue': patch
---

More Vue components are now wrapped in `defineVaporComponent`, and wrapped components can be read above their declaration:

- An arrow component that contains a nested function, such as an inline `onClick={() => …}` handler or a `.map()` callback, is now wrapped. Before, it stayed a plain function, and mounting it as the app root threw `Cannot read properties of undefined (reading 'config')`.
- A default-exported component that contains a nested function now compiles to `export default defineVaporComponent(…)`. Before, it compiled to the invalid `export default const …`.
- A component that builds its JSX in a local variable and returns it (`const element = <div />; return element;`) is now wrapped. Before, its props never reached it and mounting it as the app root threw.
- A component read above its declaration, as in `export const registry = { inner: Inner }` before `function Inner`, now loads. Before, the module threw `Cannot access 'Inner' before initialization`, because the wrapped component is a `const`. The compiler now moves the wrapped component above the first statement that reads it while the module (or block) runs.
