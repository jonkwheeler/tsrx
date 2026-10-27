---
'@tsrx/bun-plugin-vue': patch
'@tsrx/bun-plugin-hono': patch
---

The Vue and Hono Bun plugins now work as `bun:test` preloads registered with `Bun.plugin()`.

- `@tsrx/bun-plugin-vue` no longer fails every test file with "Expected module mock to return an object". Its `createVaporApp` interop hook now returns modules it leaves unchanged to the runtime, and it skips `node_modules` in its filter ([#1151](https://github.com/tsrx-org/tsrx/issues/1151)).
- `@tsrx/bun-plugin-hono` now loads components with a `<style>` block, which failed with `Expected loader to be one of "js", …`. Its virtual stylesheets now use the `file` namespace, the only one where Bun's runtime accepts the `css` loader, as the other Bun plugins do ([#1152](https://github.com/tsrx-org/tsrx/issues/1152)).
