---
'@tsrx/solid': patch
---

On Solid, the setup statements of an `@else`, `@default`, `@empty`, or
`@pending` body now run once, as setup does in an `@if` or `@case` body.
Before, the body ran inside the `<Show>`, `<Switch>`, `<For>`, or `<Loading>`
that reads its `fallback`, so each signal its setup read became a dependency
there: the setup ran again and the body's output was recreated whenever one
changed. The body now runs through `untrack`, as
`fallback={untrack(() => { … })}`.
