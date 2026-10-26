---
'@tsrx/core': patch
'@tsrx/vite-plugin-react': patch
'@tsrx/vite-plugin-preact': patch
'@tsrx/vite-plugin-solid': patch
'@tsrx/vite-plugin-vue': patch
'@tsrx/vite-plugin-hono': patch
---

The Vite plugins restart the dev server when a tsconfig change selects a different `tsrx.platform`. Before, both `.tsrx` modules and ordinary modules kept the previous platform until you restarted Vite by hand.
