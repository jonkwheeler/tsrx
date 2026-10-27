---
'@tsrx/core': patch
---

Keep the parentheses around an element or fragment that is the object of a member access, call, index, tagged template or non-null assertion, a `new` callee, or a superclass in compiled output. `return (<b>ok</b>).type === x ? 1 : 2;` compiled to `return <b>ok</b>.type === x ? 1 : 2;`, which TypeScript reads as `return <b>ok</b>;` followed by a separate statement (#1166). `class A extends (<div />) {}` compiled to `class A extends <div /> {}`, which TypeScript doesn't parse (#745). The editor output already kept them.
