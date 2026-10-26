---
'@tsrx/solid': patch
---

On Solid, a `@{ }` block inside an `@if`, `@for`, `@switch` or `@try` body now renders its output, whether it is an element's child (`<p>@{ const v = 1; <b>{v}</b> }</p>`) or the body itself. Before, the block's setup ran but its output was dropped, so `<p>` rendered empty.
