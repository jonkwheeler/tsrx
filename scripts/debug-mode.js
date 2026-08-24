import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Resolve the target package relative to the playground that invoked this
// script (process.cwd()), not relative to scripts/. Playground devDependencies
// are linked into the playground's local node_modules and are not hoisted to
// the repo root.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const package_name = process.argv[3];
const pkg = require(package_name);
const { compile } = pkg;
// Older @tsrx/* packages export snake_case; newer packages use camelCase.
const compile_to_volar_mappings = pkg.compile_to_volar_mappings ?? pkg.compileToVolarMappings;
const FILE_EXTENSIONS = ['.tsrx'];

const mode_type = process.argv[2] || 'client';

if (mode_type !== 'client' && mode_type !== 'all' && mode_type !== 'tsx') {
	console.error(`Invalid mode: ${mode_type}. Must be 'client', 'all', or 'tsx'.`);
	process.exit(1);
}
console.log(`Compiling in ${mode_type} mode...`);

const compile_modes = mode_type === 'all' ? ['client', 'tsx'] : [mode_type];
const files = (await fs.readdir('./src/')).filter((file) =>
	FILE_EXTENSIONS.some((extension) => file.endsWith(extension)),
);

for (const mode of compile_modes) {
	const dir = './src/';
	const output_dir = `./debug/${mode}`;

	await fs.rm(output_dir, { recursive: true, force: true });
	await fs.mkdir(output_dir, { recursive: true });

	for (const filename of files) {
		if (FILE_EXTENSIONS.some((extension) => filename.endsWith(extension))) {
			const source = await fs.readFile(path.join(dir, filename), 'utf-8');
			const result =
				mode !== 'tsx'
					? compile(source, filename)
					: compile_to_volar_mappings(source, filename, { loose: true });
			const base_name = filename.slice(0, -path.extname(filename).length);
			const file_path = `${output_dir}/${base_name}`;

			if (mode !== 'tsx') {
				await fs.writeFile(`${file_path}.tsx`, result.code);
				if (result.css) {
					await fs.writeFile(`${file_path}.css`, result.css);
				}
			} else {
				await fs.writeFile(`${file_path}.tsx`, result.code);

				// Also output mappings for debugging
				await fs.writeFile(`${file_path}.mappings.json`, JSON.stringify(result.mappings, null, 2));
			}
		}
	}
}
