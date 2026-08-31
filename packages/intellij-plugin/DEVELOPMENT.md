# IntelliJ plugin development

## Build and verify locally

Run commands from the repository root with Java 21. The wrapper downloads the
configured JDK when one is not already available.

```sh
node scripts/sync-intellij-plugin-version.js --check
packages/intellij-plugin/gradlew -p packages/intellij-plugin test
packages/intellij-plugin/gradlew -p packages/intellij-plugin verifyPluginProjectConfiguration
packages/intellij-plugin/gradlew -p packages/intellij-plugin buildPlugin verifyPluginStructure
```

The unsigned archive is written to `packages/intellij-plugin/build/distributions`.
The archive must contain the plugin descriptors, MIT license, icon, language
server version, and the generated TextMate bundle.

## Compatibility matrix

`advertisedProductTypes` and `minimumPlatformVersion` in `gradle.properties` are
the source of truth for the Marketplace compatibility claim. The plugin has two
feature tiers:

- Every listed IDE receives the TSRX file type, commenter, icon, and TextMate
  syntax highlighting.
- IDEs that expose both the Ultimate and LSP modules additionally receive
  diagnostics, completion, navigation, and formatting from
  `@tsrx/language-server`.

The matrix covers WebStorm, IntelliJ IDEA Ultimate and Community, PhpStorm,
PyCharm, DataSpell, RubyMine, CLion, DataGrip, GoLand, Rider, and RustRover.
Minimum 2025.2 WebStorm and IntelliJ IDEA Ultimate are explicit anchors; every
listed product is also checked against its latest release channel build.

Run the complete matrix with:

```sh
packages/intellij-plugin/gradlew -p packages/intellij-plugin verifyPlugin
```

For one target, use the same properties as the CI matrix:

```sh
packages/intellij-plugin/gradlew -p packages/intellij-plugin verifyPlugin \
  -PverificationProductType=WebStorm \
  -PverificationProductVersion=2025.2
```

Plugin Verifier treats binary compatibility problems, internal API use, invalid
overrides, and invalid plugin archives as fatal. Optional modules and hot-unload
eligibility remain visible in the retained reports without rejecting an otherwise
compatible product. Reports are written to
`packages/intellij-plugin/build/reports/pluginVerifier`.

The one checked-in ignored-problem rule permits the LSP package itself to be
absent in syntax-only IDEs. It does not ignore missing methods, changed
signatures, or API-policy violations when the package exists. Keep the rule
package-specific; never broaden it to all unresolved classes.

## Install-from-disk smoke test

Build the ZIP, then open **Settings → Plugins → ⚙ → Install Plugin from Disk** in
a clean IDE profile and select that exact archive.

For the syntax-only tier, open `src/App.tsrx` from the test fixture in IntelliJ
IDEA Community. Confirm the TSRX icon, line comments, and non-empty syntax
highlighting, and confirm no language-server download starts. For the LSP tier,
repeat in WebStorm with a trusted project. Confirm diagnostics and completion,
then inspect the IDE log for a project-local, PATH, or exact managed
`@tsrx/language-server` resolution.

The managed language server is installed with npm lifecycle scripts disabled.
Before changing its pinned version, prove the published package works with:

```sh
npm install @tsrx/language-server@<exact-version> \
  --prefix <temporary-directory> --no-audit --no-fund --ignore-scripts
```

If syntax assets appear stale or damaged, close the IDE and remove only the
`tsrx-textmate` directory under that IDE's system directory. Restarting recreates
it from the packaged bundle. Do not delete the entire IDE system directory.

## Continuous integration

`.github/workflows/intellij-plugin.yml` runs only when the IntelliJ package,
canonical TextMate grammar, version synchronizer, changesets, or the workflow
itself changes. It tests and builds once, then verifies each matrix target in an
isolated job. Pull-request jobs receive read-only repository permissions and no
Marketplace or signing credentials. The workflow retains the unsigned ZIP and all
Plugin Verifier reports as diagnostic artifacts.
