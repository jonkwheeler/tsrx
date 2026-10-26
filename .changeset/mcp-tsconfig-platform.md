---
'@tsrx/mcp': patch
---

`compile-tsrx`, `analyze-tsrx`, and `validate-tsrx-file` now compile with the `tsrx.platform` set in the project's `tsconfig.json` (the nearest one to the file), so a file using `import.meta.env.platform` flags no longer fails with "Platform flag usage requires a configured TSRX platform" in a project that already selects a platform.
