---
'@tsrx/core': patch
---

Static JSX stays in place when its tag reads a binding declared in an earlier `case` of the same `switch`, or the next name of a dotted namespace it is in (`Foo` inside `namespace Outer.Foo`). Before, it was hoisted to module scope, where the tag named a different binding of the same name.
