---
'@tsrx/core': patch
'@tsrx/runtime': patch
'@tsrx/react': patch
'@tsrx/preact': patch
'@tsrx/solid': patch
'@tsrx/hono': patch
---

A host element with scoped styles keeps the class a props spread passes it. Beside a `<style>` block, `<span {...props} />` used to render only the scope hash and drop `props.className`, and `<span className="base" {...props} />` dropped the scope hash. Both now render the spread's class followed by the scope classes, which is what plain JSX renders plus the scope hash, on React, Preact, Solid, and Hono. Vue already joined them ([#722](https://github.com/tsrx-org/tsrx/issues/722)).
