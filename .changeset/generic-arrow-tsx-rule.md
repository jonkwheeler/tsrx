---
'@tsrx/core': minor
'@tsrx/react': minor
'@tsrx/preact': minor
'@tsrx/solid': minor
'@tsrx/vue': minor
'@tsrx/hono': minor
'@tsrx/prettier-plugin': minor
---

A `<` starts a generic arrow function only where TypeScript's rule for `.tsx` files says it does (#183): a type parameter followed by a comma, a default, or a constraint. A lone type parameter without one is now a tag, as in TSX, so `<T>(x) => x` no longer compiles or formats. To migrate, add the trailing comma: `<T>(x) => x` becomes `<T,>(x) => x` (`<const T>` becomes `<const T,>`). The error for the old form, an unclosed `<T>` tag, now says to add it.

The rule reads no further than the type parameter, so a generic arrow with a constraint compiles whatever its parameters hold (comments, regular expressions, template literals), and an element whose text starts like an arrow function, such as `<b>(i) => i</b>` or `<script>(i) => i</script>`, is read as an element (#734).
