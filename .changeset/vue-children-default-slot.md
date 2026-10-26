---
'@tsrx/vue': patch
---

Vue components now render their nested children through `props.children`, as on the other targets. vue-jsx-vapor passes nested children as the default slot, so `props.children` was always `undefined` and `<Card><p>child</p></Card>` rendered without the `<p>`. A read of `props.children`, or of a `children` binding destructured from the props parameter or from `props` at the top of the component (`const { children } = props`), now uses the `children` prop when the caller passes one and the default slot otherwise. The editor's type view still shows `props.children` as written.
