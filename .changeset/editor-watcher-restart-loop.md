---
'@tsrx/language-server': patch
'@tsrx/vscode-plugin': patch
---

The VS Code extension no longer makes the extension host run out of memory in a large workspace ([#1084](https://github.com/tsrx-org/tsrx/issues/1084)). The TSRX language server watched every TypeScript, JavaScript and JSON file, `node_modules` included, and vscode-languageclient holds file events until none has arrived for 250 ms, so dev servers that write files all the time grew that queue without limit. Beside the editor's TypeScript (the `plugin` and `native` backends), the server now watches only `.tsrx` files, JSON files and lockfiles, and the extension keeps events from `node_modules` to itself. A `package.json` under `node_modules` or a framework build directory (`.next`, `.nuxt`, `.output`, `.svelte-kit`, `.turbo`, `.vercel`), such as the one Vite writes in `node_modules/.vite/deps`, no longer restarts the server, and a restart waits until package files have stopped changing for a second.
