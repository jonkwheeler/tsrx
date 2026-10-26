---
'@tsrx/typescript-plugin': patch
'@tsrx/vscode-plugin': patch
---

On TypeScript 5.9 and 6, auto-import now adds the import in two cases where it inserted nothing in a `.tsrx` file: the auto-import completion for a name that needs a new import line ([#1026](https://github.com/tsrx-org/tsrx/issues/1026)), and the completion and the **Add import from** quick fix in a file that has no imports yet ([#828](https://github.com/tsrx-org/tsrx/issues/828)).
