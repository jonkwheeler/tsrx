---
'@tsrx/hono': patch
---

A dynamic tag (`<{props.tag} />`) no longer gets TS2786 (`cannot be used as a JSX component`) in the editor's type view with Hono 4.13. The type-only `Dynamic` helper now returns what a Hono function component returns, which Hono 4.13's `JSX.ElementType` requires (#1075).
