---
'@tsrx/core': patch
---

On React, Preact and Hono, a static element inside an expression container is now hoisted to a module-level constant, like a static element written bare. `<>{<div> 123 </div>}</>` hoisted nothing before; now the inner `<div>` gets its own constant (#81). This covers a container in an element's or a fragment's children, in an attribute value such as `<Card header={<h1>Title</h1>} />`, in either branch of `?:`, on the right of `&&`, `||` and `??`, and in a nested container. A static fragment in a container keeps its children, each hoisted on its own, and consecutive statics are not merged into one fragment, so the children React sees keep their shape. An element with a `key`, JSX that reads a binding, a bare child of a dynamic element, and JSX inside a callback, array or other expression stay in place. Solid, Vue and Hono DOM output is unchanged, since those targets don't hoist.
