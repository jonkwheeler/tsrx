---
'@tsrx/turbopack-plugin-react': minor
'@tsrx/core': patch
---

Next App Router builds with Turbopack no longer fail on components with a scoped `<style>` block. The loader now imports the generated stylesheet by a relative path, and the stylesheet is linked into the page when a server component imports the component, in `next dev` and `next build` ([#565](https://github.com/tsrx-org/tsrx/issues/565)). The Pages Router still rejects these imports with Next's "Global CSS cannot be imported from files other than your Custom <App>" error.

`create_tsrx_react_turbopack_css_rule()` and the `TsrxReactTurbopackCssRule` type now use `as: '*.css'` instead of `type: 'css'`. If you spread or inspect this rule, expect `as: '*.css'`.

With a platform selected, ordinary `.js`, `.jsx`, `.ts` and `.tsx` modules are read with their own grammar while platform flags are replaced: comment-like JSX text such as `<pre>/*</pre>` no longer fails with "Unclosed tag", a flag inside `{…}` next to such text is replaced, and `.ts` files can use `<T>value` type assertions ([#910](https://github.com/tsrx-org/tsrx/issues/910)).
