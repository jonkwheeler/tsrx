import { describe, expect, it } from 'vitest';
import { addVaporInteropToCreateVaporApp } from '../src/interop.js';

describe('addVaporInteropToCreateVaporApp', () => {
	it('leaves import-like text in strings, template literals and comments alone', () => {
		for (const input of [
			`export const example = "import { createVaporApp } from 'vue';";`,
			'export const example = \'import { createVaporApp } from "vue";\';',
			"export const example = `import { createVaporApp } from 'vue';`;",
			"export const example = `${'a'} import { createVaporApp } from 'vue';`;",
			`// import { createVaporApp } from 'vue';\ncreateVaporApp();`,
			`/* import { createVaporApp } from 'vue'; */\ncreateVaporApp();`,
			`const pattern = /import { createVaporApp } from 'vue'/;`,
		]) {
			expect(addVaporInteropToCreateVaporApp(input)).toBe(input);
		}
	});

	it('rewrites the real import of a module that also has import-like strings', () => {
		const example = `const example = "import { createVaporApp } from 'vue';";`;
		const output = addVaporInteropToCreateVaporApp(`const quote = /["'\`]/;
${example}
import { createVaporApp } from 'vue';
createVaporApp(App).mount('#root');`);

		expect(output).toContain(example);
		expect(output).toContain(
			`import { createVaporApp as __tsrx_createVaporApp, vaporInteropPlugin } from 'vue';\nconst createVaporApp = (...args) => __tsrx_createVaporApp(...args).use(vaporInteropPlugin);`,
		);
	});
});
