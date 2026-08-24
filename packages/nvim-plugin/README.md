# TSRX Neovim Plugin

Neovim integration for `.tsrx` files, including Tree-sitter highlighting and
`@tsrx/language-server` integration.

## Requirements

- Neovim 0.11 or newer
- [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
- Node.js 22 or newer

## Installation

With `lazy.nvim`:

```lua
{
  "tsrx-org/tsrx",
  config = function(plugin)
    vim.opt.rtp:append(plugin.dir .. "/packages/nvim-plugin")
    require("tsrx").setup(plugin)
  end
}
```

The plugin uses a project-local or global `tsrx-language-server` when available.
Otherwise, it installs the exact `@tsrx/language-server` version pinned in this
package's `config` field.

The Tree-sitter parser is built from `grammars/tree-sitter` in this repository.
