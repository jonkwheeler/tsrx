---
'@tsrx/content-mapper': patch
---

On TypeScript 7 (native `tsrx-tsc` or `tsc --runExternalCode`), two `.tsrx` modules that use `import.meta.env.platform` flags no longer fail with `TS2374` (duplicate index signature on `ImportMeta`), and declaration output (`Component.d.tsrx.ts`) no longer carries the editor-only `ImportMetaEnv` / `ImportMeta` globals. The mapper now replaces the `declare global` block that the compiler appends to each such module with a type-only import of one shared declaration file (shipped in the new `platform-globals/` directory), which TypeScript loads once and leaves out of declaration output. Authored global augmentations are kept.
