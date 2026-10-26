---
'@tsrx/solid': minor
---

**Breaking (Solid target):** the `@catch` binding is now the thrown value, as on
every other target, instead of Solid's error accessor. Code written for the old
shape must drop the call: `@catch (err) { <p>{err().message}</p> }` becomes
`@catch (err) { <p>{err.message}</p> }`, and `err()` now throws because `err` is
not a function. Destructuring patterns such as `@catch ({ message })` now bind
the thrown value's properties. The binding is typed `unknown`, so check it
before reading `message`.
