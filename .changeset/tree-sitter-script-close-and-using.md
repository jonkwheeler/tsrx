---
'@tsrx/zed-plugin': patch
'@tsrx/nvim-plugin': patch
---

The tree-sitter grammar now ends a `<script>` body where the compiler does, at `</script` followed by optional whitespace (a line break included) and `>`. Before, `</script >` was not seen as the closing tag and the script body parsed with errors. After updating the Neovim plugin, rebuild the parser with `:TSInstall! tsrx`.
