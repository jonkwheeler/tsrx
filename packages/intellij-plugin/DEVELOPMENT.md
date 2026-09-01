# IntelliJ plugin development

## Build and verify locally

Run commands from the repository root with Java 21:

```sh
node scripts/sync-intellij-plugin-version.js --check
packages/intellij-plugin/gradlew -p packages/intellij-plugin \
  test verifyPluginProjectConfiguration buildPlugin verifyPluginStructure verifyPlugin
```

The archive is written to `packages/intellij-plugin/build/distributions`. It
contains the plugin descriptors, MIT license, icon, pinned language-server
version, and generated TextMate bundle.

The plugin targets compatible IntelliJ-based IDEs from 2025.2 onward. WebStorm
2025.2.4 is the reference build used for compilation, platform tests, and Plugin
Verifier. Syntax support does not load the optional LSP classes; IDEs exposing the
Ultimate and LSP modules additionally receive language-server features.

## Install-from-disk smoke test

Build the ZIP, then open **Settings → Plugins → ⚙ → Install Plugin from Disk** in
a clean IDE profile and select that archive.

In WebStorm, open `src/App.tsrx` from the test fixture and confirm the icon,
comments, syntax highlighting, diagnostics, completion, navigation, and
formatting. In a syntax-only IDE, confirm the file type and highlighting work
without starting a language-server download.

The managed language server is installed with npm lifecycle scripts disabled.
Before changing its pinned version, verify the published package with:

```sh
node packages/intellij-plugin/scripts/verify-language-server-release.mjs
```

## Continuous integration

`.github/workflows/intellij-plugin.yml` contains one pull-request job. It runs
only when the IntelliJ plugin, canonical TextMate grammar, or their generation
scripts change, and performs the platform tests, build, structure checks, and one
WebStorm Plugin Verifier pass.

## Signing and Marketplace publication

The plugin XML ID is `tsrx.intellij-plugin`. The deleted third-party listing used
a different ID and is intentionally not reused.

Changesets owns the plugin version. When the **Version Packages** commit changes
`packages/intellij-plugin/package.json`, the single job in
`.github/workflows/intellij-plugin-publish.yml` repeats the release checks, signs
the archive, and looks up the XML ID on Marketplace:

- Before the first listing exists, it uploads the signed ZIP as a workflow
  artifact for the required manual Marketplace submission.
- After the listing exists, it publishes the signed update automatically.

Configure `CERTIFICATE_CHAIN`, `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD`, and
`PUBLISH_TOKEN` in the protected `jetbrains-marketplace` GitHub environment. The
first three values are required for every release; `PUBLISH_TOKEN` is only used
after the initial listing exists.

See [MARKETPLACE_RELEASE.md](./MARKETPLACE_RELEASE.md) for the first-submission
checklist.
