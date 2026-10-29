# @tsrx/eslint-plugin

[![npm version](https://img.shields.io/npm/v/%40tsrx%2Feslint-plugin?logo=npm)](https://www.npmjs.com/package/@tsrx/eslint-plugin)
[![npm downloads](https://img.shields.io/npm/dm/%40tsrx%2Feslint-plugin?logo=npm&label=downloads)](https://www.npmjs.com/package/@tsrx/eslint-plugin)

ESLint rules and flat configurations for target-neutral TSRX syntax.

## Installation

```bash
pnpm add --save-dev eslint @tsrx/eslint-parser @tsrx/eslint-plugin
```

## Usage

```js
// eslint.config.js
import tsrx from '@tsrx/eslint-plugin';

export default [...tsrx.configs.recommended];
```

The recommended configuration:

- uses `@tsrx/eslint-parser` for `.tsrx` files when installed;
- uses `@typescript-eslint/parser` for `.ts` and `.tsx` files when installed;
- registers the plugin under the `tsrx` rule namespace;
- ignores declaration files, dependencies, and common build output folders.

Use the strict configuration to enable the same syntax rules at error severity:

```js
import tsrx from '@tsrx/eslint-plugin';

export default [...tsrx.configs.strict];
```

## Rules

- `tsrx/control-flow-jsx` requires template output in returned `@for` blocks.
- `tsrx/require-statement-container-body` detects component bodies that need the
  `@{ ... }` statement-container marker.
- `tsrx/valid-for-of-key` validates identifiers used in TSRX loop keys.
- `tsrx/no-return-in-component` is a deprecated no-op retained for compatibility.
- `tsrx/no-unused-vars` is ESLint's `no-unused-vars`, except that its suggestion
  for an unused `@for` index removes the whole `; index i` clause. The core rule's
  suggestion deletes only the name and leaves `index )`, which doesn't parse.
- `tsrx/no-await-in-loop` is ESLint's `no-await-in-loop`, and also reports an
  `await` in a `@for` key, which runs once per item, as the body does.
- `tsrx/no-unreachable` is ESLint's `no-unreachable`, with the arms of a `@switch`
  as alternatives. After an arm that throws, it doesn't report the other arms or
  the code after the `@switch`. It still reports unreachable code inside an arm.

### Core Rules in the Configurations

For `.tsrx` files, `recommended` and `strict` turn off ESLint's `no-unused-vars`,
`no-await-in-loop` and `no-unreachable`, and turn on their `tsrx/` versions at
`error`. Every other report and suggestion is the core rule's. A configuration
can't read the severity or options another one gives the core rule, so:

- list `tsrx.configs.recommended` after `js.configs.recommended`, or after any
  other configuration that turns these core rules on. Otherwise both versions run
  on `.tsrx` files and report the same problems twice;
- give `tsrx/no-unused-vars` the options you give `no-unused-vars`;
- set a `tsrx/` rule to `warn` or `off` to change its severity.
  `tsrx/no-await-in-loop` is on even though `js.configs.recommended` leaves
  `no-await-in-loop` off.

```js
import js from '@eslint/js';
import tsrx from '@tsrx/eslint-plugin';

export default [
  js.configs.recommended,
  ...tsrx.configs.recommended,
  {
    files: ['**/*.tsrx'],
    rules: {
      'tsrx/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'tsrx/no-await-in-loop': 'off',
    },
  },
];
```

Target runtime rules do not belong in the shared recommended configuration. For
example, Ripple-specific `track()` placement and DOM event guidance should be
provided by Ripple-owned tooling rather than applied to every TSRX target.

See the [TSRX documentation](https://tsrx.dev/) and
[`@tsrx/eslint-parser`](https://github.com/tsrx-org/tsrx/tree/main/packages/eslint-parser).
