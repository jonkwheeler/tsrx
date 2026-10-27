---
'@tsrx/core': minor
---

A `var` declared in an `@if`, `@for`, `@switch` or `@try` body (including `@else`, `@empty`, `@case`, `@default`, `@pending` and `@catch` bodies), or in a plain block or loop inside one, is now reported as TSRX2030 on every target, at the `var` keyword, with a hint to use `const` or `let`. Before, it compiled without an error, but the body runs in a function of its own, so code after the directive that read the variable threw `ReferenceError` at render. A `var` in a function or class inside the body is still allowed.

Migration: declare the variable with `const` or `let`. If code after the directive reads the value, compute it before the directive instead, since some targets run the body later or more than once.
