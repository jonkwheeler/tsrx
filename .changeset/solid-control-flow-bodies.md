---
'@tsrx/solid': patch
---

Two Solid control-flow fixes:

- A `@{ }` block inside an `@if`, `@for`, `@switch` or `@try` body now renders its output, whether it is an element's child (`<p>@{ const v = 1; <b>{v}</b> }</p>`) or the body itself. Before, the block's setup ran but its output was dropped, so `<p>` rendered empty.
- `@switch` now reads its discriminant once and compares every case with that value. Before, each case read it again, so a discriminant with a side effect, such as `@switch (queue.shift())`, consumed one value per case and could render the wrong branch, on the server and in the browser. A discriminant that is not a plain name or property read is now held in a `createMemo`.
