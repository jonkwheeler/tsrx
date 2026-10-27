---
'@tsrx/vue': patch
'@tsrx/core': patch
---

Vue now reports a destructured prop that vue-jsx-vapor reads wrongly, instead of compiling a component that silently gets the wrong value:

- The new TSRX2031 reports a key vue-jsx-vapor misreads. It reads a destructured prop by its key's name, so `function Card({ [k]: v })` read the prop `k`, whatever `k` held, and lost any default. It reads only keys that are names, so a binding at any other key (`{ 'a-b': v }`, `{ ['s']: v }`, `{ [1]: v }`) never got the prop: it was left out of the component, and a component with no key it reads got no prop options at all, so Vue passed it no props.
- TSRX2029 now also reports a default inside a destructured prop (`{ s: { a = 3 } }`), which vue-jsx-vapor applies only when the whole prop is missing, so it was lost whenever `s` was passed without `a`.

The errors suggest taking a `props` parameter and reading the prop where it is used, so it stays reactive: for example `{props.s === undefined ? 3 : props.s}`, which, like a default, replaces only `undefined`, or a `computed`. A kebab-case key is read by its camelized name (`props.aB`). TSRX2029's existing advice, to read the prop once into a constant, changes the same way. The TSRX2028, TSRX2029 and TSRX2031 messages are now in `@tsrx/core/diagnostics` (`TSRX_ERRORS`).
