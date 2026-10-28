---
'@tsrx/eslint-plugin': patch
---

Add `tsrx/jsx-curly-brace-presence`, a TSRX version of `react/jsx-curly-brace-presence` with the same options and messages ([#1249](https://github.com/tsrx-org/tsrx/issues/1249)). It doesn't unwrap a string child that TSRX text would read as syntax. That covers a directive such as `{'@for (item of items)'}`, a comment such as `{'// note'}`, and the first child of a `<style>`. With the react rule, `--fix` turned those into a file that doesn't parse, or into a comment that silently drops the text. The recommended and strict configurations use it for `.tsrx` files and turn `react/jsx-curly-brace-presence` off there.
