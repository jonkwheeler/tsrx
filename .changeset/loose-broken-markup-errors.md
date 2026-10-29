---
'@tsrx/core': patch
---

A loose compile, the one the editor, `tsrx-tsc` and `@tsrx/content-mapper` run, now reports an unclosed tag (TSRX1001) or a mismatched closing tag (TSRX1002), as a collecting compile does, instead of recovering silently. `<div>` with no closing tag, `<div><span></div>` and `return <div>;` now show an error in the editor and through TypeScript 7's `tsc --runExternalCode`, where the build's strict compile already rejected them. The recovery is unchanged, so the generated code and the rest of the file stay as they were.
