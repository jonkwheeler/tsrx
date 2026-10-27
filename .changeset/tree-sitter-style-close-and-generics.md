---
'@tsrx/zed-plugin': patch
'@tsrx/nvim-plugin': patch
---

The tree-sitter grammar now ends a `<style>` body where the compiler does, at `</style` followed by optional whitespace (a line break included) and `>`, as it already did for `<script>`. Before, `</style >` was not seen as the closing tag and the file parsed as an error from the start. After updating the Neovim plugin, rebuild the parser with `:TSInstall! tsrx`.
