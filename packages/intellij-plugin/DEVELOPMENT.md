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

## Signing and Marketplace publication

Do not sign or publish from a maintainer workstation. The manual **Publish
IntelliJ Plugin** workflow accepts an exact commit SHA and has two routes:

- `stage` signs and verifies the already-tested ZIP, records both SHA-256 digests,
  and retains the signed artifact for the first Marketplace UI upload. It never
  reads `PUBLISH_TOKEN` or invokes `publishPlugin`.
- `publish` performs the same work and then uploads that exact signed ZIP with
  Gradle. Use it only after the first listing exists; JetBrains requires the
  initial upload through the Marketplace UI.

The workflow can run only when dispatched from `main`, and the supplied SHA must
equal the current remote `main` head. Before the protected job can start, the
entire compatibility workflow passes and the exact pinned `@tsrx/language-server`
package installs from npm with lifecycle scripts disabled. The protected job
rebuilds the unsigned ZIP and byte-compares it with the verified artifact before
signing.

### One-time protected environment setup

1. Follow JetBrains' current
   [plugin-signing guide](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html)
   to generate the RSA private key and certificate chain. Store the complete
   values as `PRIVATE_KEY`, `PRIVATE_KEY_PASSWORD`, and `CERTIFICATE_CHAIN`
   secrets in the `jetbrains-marketplace` GitHub environment. JetBrains accepts
   PEM or base64-encoded multiline values. Never commit these values, put them in
   workflow inputs, or paste them into logs.
2. In the Marketplace profile that owns the TSRX vendor, create a dedicated
   personal access token and save it as `PUBLISH_TOKEN` in the same environment.
   The staging route does not require this secret.
3. Restrict the environment to `main`, require an accountable reviewer, and
   prevent administrators from bypassing the protection. Keep repository-level
   secrets empty; all four values belong only to this environment.
4. Review immutable action revisions whenever Dependabot proposes an update. The
   release workflow and every action that produces the archive use full commit
   SHAs, not mutable version tags.

### First submission

Merge the synchronized patch version to `main`, copy the full head SHA, and run
the workflow in `stage` mode from the `main` branch. Download the retained
artifact and use the signed ZIP—not the unsigned build artifact—for the
Marketplace UI submission. Record the workflow URL, commit, plugin version,
language-server version, signed ZIP SHA-256, vendor, and reviewer with the
submission. Keep the artifact for its full 90-day retention period.

Marketplace review feedback that changes code, descriptors, dependencies, or
archive contents requires a new patch version and a complete new run. Do not
replace or rebuild an already submitted version. Metadata-only feedback can keep
the artifact when its recorded digest remains unchanged.

### Later updates and failures

After the listing exists, dispatch `publish` with a new synchronized patch version
at the current `main` head. A duplicate version is expected to fail at
Marketplace; bump the package through Changesets instead of overwriting it. If the
upload fails before Marketplace accepts it, the `always()` artifact step retains
the signed ZIP and evidence. Retry that byte-identical ZIP through the Marketplace
UI rather than rebuilding the same version.

For a bad approved release, stop promotion and use Marketplace controls to hide or
withdraw it when available. Restore the prior listing state and publish a higher
patch only after the triggering smoke test passes. Never reuse the failed version
number.

Rotate the Marketplace token and signing key on the vendor's normal security
schedule, when a maintainer loses access, or immediately after suspected exposure.
Revoke the old token first, replace the environment secrets, generate a fresh
staged artifact, and retain the incident's commit and digests. If a key may be
compromised, follow JetBrains support guidance for certificate revocation before
publishing again.
