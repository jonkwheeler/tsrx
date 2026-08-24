local M = {}

function M.setup(plugin)
	vim.filetype.add {
		extension = {
			tsrx = "tsrx",
		},
	}

	require("tsrx.treesitter").setup(plugin)
	require("tsrx.lsp").setup()
end

return M
