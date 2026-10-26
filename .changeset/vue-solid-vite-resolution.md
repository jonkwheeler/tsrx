---
'@tsrx/vite-plugin-vue': patch
'@tsrx/vite-plugin-solid': patch
'@tsrx/vue': patch
---

The Vue and Solid Vite plugins now compile an import that resolves to a `.tsrx` file even when the specifier has no `.tsrx` extension, such as a package whose `exports` point at a `.tsrx` file. Before, the build failed with "Expected function body".

The Vapor interop rewrite (`@tsrx/vue/interop`, used by the Vue Vite, Bun and Rspack integrations) now changes only real `import { createVaporApp } from 'vue'` declarations. Before, the same text inside a string, template literal, comment or regular expression was rewritten too, which broke the build with "Unterminated string".
