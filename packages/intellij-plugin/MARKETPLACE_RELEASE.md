# JetBrains Marketplace first-release record

Status: **NO-GO — Marketplace ID ownership unresolved**

This file is the durable evidence record for the first public release of the TSRX
JetBrains plugin. It must not contain signing keys, tokens, passwords, or other
credentials.

## Stable identity

- Plugin XML ID: `dev.tsrx.intellij_plugin`
- Intended vendor: `TSRX`
- Source: `https://github.com/tsrx-org/tsrx`
- License: MIT
- Homepage: `https://tsrx.dev/`
- Observed Marketplace URL: `https://plugins.jetbrains.com/plugin/33925-tsrx`
- Observed numeric Marketplace plugin ID: `33925`
- Repository-controlled Marketplace URL: pending ownership resolution

On 2026-08-31, JetBrains' public APIs returned a public listing for this XML ID.
The listing reports version `1.0.6`, an unverified vendor named `TSRX`, and a
source URL of `https://github.com/rodrigobertin/TSRX-jetbrains-plugin`. This
repository has not established that it controls that vendor or listing. Do not
treat the observed listing as this repository's official release channel until
ownership is confirmed.

Before upload, an accountable maintainer must choose and record one of these
paths:

1. Establish or transfer control of Marketplace plugin `33925` with the current
   vendor and JetBrains. Confirm the TSRX vendor and token can update the listing,
   then use `publish` mode.
2. Select a new immutable XML ID for this repository's official plugin. Update
   code, tests, release metadata, and this record, confirm the new ID is free,
   then use `stage` mode.

Stop if the ID or vendor remains disputed. A Marketplace XML ID cannot be changed
after its first public release.

- [ ] Vendor profile confirmed by: pending
- [ ] Vendor ownership confirmed at: pending
- [ ] Ownership path selected (transfer/control or new XML ID): pending
- [ ] Developer Agreement accepted by: pending
- [ ] Trader/non-trader and EEA declarations completed by: pending

## Signed artifact evidence

After the ownership path is resolved, run **Publish IntelliJ Plugin** from `main`
in the matching mode. Use `publish` only for a confirmed repository-controlled
existing listing. Use `stage` only for a free XML ID. Copy values from the
retained workflow artifact; do not calculate them from a rebuilt ZIP.

- Workflow run URL: pending
- Exact `main` commit: pending
- Plugin version: pending
- Pinned `@tsrx/language-server` version: pending
- Unsigned ZIP SHA-256: pending
- Signed ZIP SHA-256: pending
- Signed ZIP filename: pending
- Signature verification: pending
- Compatibility report artifact set: pending
- Release reviewer: pending

No-go conditions:

- The workflow revision is not the current `main` head.
- Versions are unsynchronized or the exact npm package preflight fails.
- Any advertised product-family verifier job fails or is absent.
- The rebuilt unsigned ZIP differs from the verified artifact.
- Signature verification fails, or a credential appears in logs/artifacts.
- Vendor ownership, legal declarations, or rollback ownership is unresolved.
- The selected release mode does not match the confirmed Marketplace ID state.

## Listing metadata

Complete and compare every field in the Marketplace preview before submitting:

- [ ] Name: `TSRX`
- [ ] Vendor: the confirmed TSRX vendor above
- [ ] License: MIT
- [ ] Source code: `https://github.com/tsrx-org/tsrx`
- [ ] Website: `https://tsrx.dev/`
- [ ] Plugin ID: `dev.tsrx.intellij_plugin`
- [ ] Version and change notes match the signed archive
- [ ] Icon is the packaged 40×40 TSRX icon
- [ ] Tags describe JavaScript/TypeScript, language support, and developer tools
- [ ] Compatibility preview is a subset of the retained verifier evidence
- [ ] Description distinguishes baseline syntax support from optional LSP features
- [ ] Ads, paid features, data collection, and legal declarations are accurate

Submission record:

- Marketplace submission/update ID: pending
- Submitted by: pending
- Submitted at: pending
- Review state: blocked by existing-listing ownership review
- Review thread/link: pending maintainer/vendor/JetBrains coordination

## Review log

| Date    | Reviewer or system | Feedback | Resolution | Artifact changed? | Evidence |
| ------- | ------------------ | -------- | ---------- | ----------------- | -------- |
| pending | pending            | pending  | pending    | pending           | pending  |

Any archive change requires a new patch version, a new signature and digest, and
all U2–U6 gates again. Metadata-only feedback may retain the signed ZIP only when
its digest is unchanged and recorded here.

## Post-approval Marketplace smoke

Use the same `src/test/resources/projects/basic/src/App.tsrx` fixture in clean IDE
profiles. Record the public install, not an install-from-disk result.

| Scenario            | IDE/build                                         | Required observation                                                                                                   | Result/evidence                         |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Minimum anchor      | WebStorm 2025.2                                   | Marketplace install; icon, comments, highlighting; trusted-project LSP diagnostics, completion, navigation, formatting | pending                                 |
| IntelliJ LSP anchor | IntelliJ IDEA Ultimate 2025.2+                    | Same LSP-capable behavior with no optional-class loading error                                                         | pending                                 |
| Syntax-only tier    | IntelliJ IDEA Community, advertised current build | File type, icon, comments, highlighting; no LSP download or optional-class error                                       | pending                                 |
| Missing npm         | WebStorm, npm removed from PATH                   | Syntax remains usable and one actionable notification is shown                                                         | pending                                 |
| Offline install     | WebStorm, no network and no local server          | Syntax remains usable; managed install fails safely without a retry loop                                               | pending                                 |
| Upgrade             | First public version → later real patch           | Grammar cache refreshes and the synchronized LSP pin takes effect                                                      | pending/not required for first approval |

After approval:

- [ ] Record the immutable public Marketplace URL and numeric plugin ID above.
- [ ] Confirm Marketplace vendor, source, MIT license, tags, icon, version, change
      notes, and compatibility list match this record.
- [ ] Add the public URL to `packages/intellij-plugin/README.md`, the root
      `README.md`, and `website-tsrx/public/llms.txt` in one reviewed change.
- [ ] Attach public-install smoke evidence to issue #8.
- [ ] Monitor review messages and issue reports for 24 hours and after the first
      restart/upgrade smoke.

Issue #8 stays open until these checks pass. Repository readiness, a staged ZIP,
an unverified third-party listing, or a submission awaiting review is not
equivalent to a repository-controlled public release.

## Rollback drill

- Rollback owner: pending
- Prior known-good public version: none before first approval
- Confirmed Marketplace hide/withdraw control: pending vendor confirmation
- Communication location: issue #8 and the relevant release record

Drill, without mutating the live listing:

1. Record the bad version, affected product/build, reproduction, and signed ZIP
   digest. Never overwrite or rebuild that version.
2. Stop promotion and use the confirmed Marketplace hide/withdraw control when
   available. Restore the prior known-good listing state.
3. Add a patch changeset, correct the triggering defect, and rerun U2–U6.
4. Publish only the higher patch after the failed smoke scenario passes. Rotate
   credentials first if exposure was involved.
