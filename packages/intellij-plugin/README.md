# TSRX for IntelliJ

TSRX language support for IntelliJ Platform IDEs.

## Features

- TextMate-based syntax highlighting for `.tsrx` files
- LSP integration via `@tsrx/language-server`

## Requirements

- IntelliJ-based IDE 2025.2+
- LSP features require an IDE with the LSP module
- Node.js 22+ with npm available on PATH (for LSP features)

## Language Server Resolution

The plugin looks for the TSRX language server in this order:

1. Project local `node_modules/.bin/tsrx-language-server`
2. Global `tsrx-language-server` on PATH
3. Auto-installs `@tsrx/language-server` into the IDE system directory and
   restarts LSP services

## Development

- Run `./gradlew runIde` from this directory to start a sandbox IDE with the
  plugin.

## Notes

- Syntax highlighting works without the LSP module; language features are enabled
  when LSP support is present.
- Update the pinned language server version in
  `packages/intellij-plugin/gradle.properties` (`tsrxLspVersion`) when bumping
  other editor plugins.
