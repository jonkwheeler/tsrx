---
'@tsrx/vue': patch
'@tsrx/core': patch
---

Vue now reports the new TSRX2031 for a destructured prop key that vue-jsx-vapor reads wrongly, instead of compiling a component that reads the wrong prop. vue-jsx-vapor reads a destructured prop by its key's name, so `function Card({ [k]: v })` read the prop `k`, whatever `k` held, and lost any default; and it leaves out a key that is not a name (`{ 'a-b': v }`, `{ ['s']: v }`, `{ [1]: v }`) once it reads any other prop from the pattern, or anywhere in a nested pattern, leaving its binding undefined. The error points at the key and suggests reading the prop from a `props` parameter, for example `const v = props[k]`. A pattern with no key vue-jsx-vapor reads (`{ ['s']: v = 3 }` alone) stays an ordinary destructuring parameter and still compiles. TSRX2028, TSRX2029 and TSRX2031 messages are now in `@tsrx/core/diagnostics` (`TSRX_ERRORS`), and TSRX2029's example names the destructured binding when the prop is renamed (`{ s: size = cfg.size }` suggests `const size = props.s ?? cfg.size`).
