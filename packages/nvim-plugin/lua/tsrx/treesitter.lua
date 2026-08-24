local M = {}

local function resolve_parser_install_info(plugin)
	local install_info = {
		url = 'https://github.com/tsrx-org/tsrx',
		location = 'grammars/tree-sitter',
		-- `files` is only read by nvim-treesitter's master branch; main compiles
		-- everything under `location` and ignores it.
		files = { 'src/parser.c', 'src/scanner.c' },
	}

	if plugin and type(plugin.dir) == 'string' and plugin.dir ~= '' then
		-- Local checkout: master detects a directory passed as `url`, while main
		-- only treats `path` as local (it overrides `url` there).
		install_info.url = plugin.dir
		install_info.path = plugin.dir
	end

	return install_info
end

local function add_tsrx(plugin)
	local parsers = require('nvim-treesitter.parsers')
	-- nvim-treesitter's master branch keeps parser configs in a `list` subtable
	-- (exposed via get_parser_configs()); the main rewrite returns the config
	-- table directly from the module.
	local configs = type(parsers.get_parser_configs) == 'function' and parsers.get_parser_configs()
		or parsers

	configs.tsrx = {
		install_info = resolve_parser_install_info(plugin),
		filetype = 'tsrx',
	}

	vim.treesitter.language.register('tsrx', 'tsrx')
end

function M.setup(plugin)
	add_tsrx(plugin)

	vim.api.nvim_create_autocmd('FileType', {
		pattern = { 'tsrx' },
		callback = function() pcall(vim.treesitter.start) end,
	})

	vim.api.nvim_create_autocmd('User', {
		pattern = 'TSUpdate',
		callback = function() add_tsrx(plugin) end,
	})
end

return M
