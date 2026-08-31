# TSRX for JetBrains IDEs

TSRX language support for compatible IntelliJ-based IDEs.

## Features

- TSRX file type, icon, commenting, and TextMate syntax highlighting for `.tsrx`
  files
- Diagnostics, completion, navigation, and formatting through
  `@tsrx/language-server` when the IDE exposes JetBrains' LSP module

## Requirements

- IntelliJ-based IDE 2025.2 or newer
- LSP features require both the Ultimate and LSP modules
- Node.js 22+ with npm available on PATH (for LSP features)

The verified product set is WebStorm, IntelliJ IDEA Ultimate and Community,
PhpStorm, PyCharm, DataSpell, RubyMine, CLion, DataGrip, GoLand, Rider, and
RustRover. IntelliJ IDEA Community is syntax-only; products with the optional
modules receive the LSP feature tier.

## Installation status

This repository has not published an official JetBrains Marketplace release. A
[public listing](https://plugins.jetbrains.com/plugin/33925-tsrx) currently uses
the configured plugin ID, but its source points to a different repository and
ownership has not been confirmed as TSRX's release channel.

Until maintainers resolve the Marketplace ID and publish a repository-controlled
release, build the ZIP with:

```sh
packages/intellij-plugin/gradlew -p packages/intellij-plugin buildPlugin
```

Then use **Settings → Plugins → ⚙ → Install Plugin from Disk** and select the ZIP
from `packages/intellij-plugin/build/distributions`. Do not present the existing
listing as this repository's official release until the release record contains
confirmed ownership and public-install evidence.

## Language Server Resolution

The plugin looks for the TSRX language server in this order:

1. Project local `node_modules/.bin/tsrx-language-server`
2. Global `tsrx-language-server` on PATH
3. Installs the exact pinned `@tsrx/language-server` version into a versioned IDE
   system directory with npm lifecycle scripts disabled, validates its package
   identity and launcher, and restarts LSP services

Automatic resolution and installation run only for trusted projects. Syntax
highlighting remains available when npm or the network is unavailable; the IDE
shows an actionable notification instead of repeatedly starting a broken server.

## Development and release

- See [DEVELOPMENT.md](./DEVELOPMENT.md) for local tests, compatibility
  verification, install-from-disk smoke tests, and protected publication setup.
- Use [MARKETPLACE_RELEASE.md](./MARKETPLACE_RELEASE.md) as the first-official-
  release evidence record. Its no-go gates must be cleared before upload or issue
  closure.
- Run `./gradlew runIde` from this directory to start a sandbox IDE with the
  plugin.

## Notes

- Syntax highlighting works without the LSP module; language features are enabled
  when LSP support is present.
- Plugin and language-server versions are synchronized by the repository's
  Changesets workflow. Do not hand-edit a duplicate release version.
