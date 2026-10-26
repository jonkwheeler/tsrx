---
'@tsrx/eslint-parser': patch
'@tsrx/core': patch
---

ESLint no longer crashes on a `.tsrx` file that uses `@switch` ([#913](https://github.com/tsrx-org/tsrx/issues/913)). The ESLint parser now gives ESLint the file's comments and tokens, so `eslint-disable` and other directive comments apply in `.tsrx` files ([#454](https://github.com/tsrx-org/tsrx/issues/454)), and rules that read tokens work: `no-unused-vars` reports an unused function parameter instead of crashing ([#228](https://github.com/tsrx-org/tsrx/issues/228)). A parse with `keywordTokens` records every token on the program as `tsrx_tokens`.
