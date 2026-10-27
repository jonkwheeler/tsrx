---
'@tsrx/core': patch
---

An export list inside a `declare namespace` or `declare module` body can now name a function declared in that body, such as `declare namespace Q { function f(): void; export { f }; }`, overloads and `export { f as g }` included. Before, the file failed with `Export 'f' is not defined`. An export of a name that the body and the scopes around it don't declare is still reported.
