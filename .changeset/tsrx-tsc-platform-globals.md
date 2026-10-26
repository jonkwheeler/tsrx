---
'@tsrx/typescript-plugin': patch
---

`tsrx-tsc` no longer writes the editor-only `ImportMetaEnv` / `ImportMeta` globals into the declaration files of `.tsrx` modules that use `import.meta.env.platform` flags. Before, a consumer that imported two such modules failed with `TS2374: Duplicate index signature`, and every emitted module forced the library's platform onto the consumer's `import.meta.env` types.
