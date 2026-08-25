# VS Code extension development and publishing

## Build locally

From the repository root:

```sh
pnpm --filter @tsrx/vscode-plugin build-and-package
```

This creates `packages/vscode-plugin/vscode-plugin.vsix`. Install that exact
artifact locally with:

```sh
pnpm --filter @tsrx/vscode-plugin install-package
```

## Publishing workflows

`.github/workflows/vsix.yml` publishes after a push to `main` changes files in
this package and the extension version differs from the previous commit.
`.github/workflows/vsix-manual.yml` packages and publishes the current commit when
manually dispatched. Both workflows publish the same VSIX to the Visual Studio
Marketplace and Open VSX.

Visual Studio Marketplace publishing uses Microsoft Entra workload identity
federation. GitHub obtains a short-lived Azure credential through OIDC, and `vsce`
consumes it with `--azure-credential`. Do not create a `VSM_TOKEN` or store an
Azure client secret. Open VSX publishing remains authenticated by the `OVSX_TOKEN`
repository secret.

The workspace's `@vscode/vsce` version must remain at least `2.26.1` for
`--azure-credential` support.

## One-time Visual Studio Marketplace setup

1. Create a user-assigned managed identity in the Azure subscription used for
   release automation. Assign the minimum Azure role needed to log in; Microsoft
   currently documents the Reader role for this publishing flow.
2. Add a federated credential to that identity for GitHub Actions:

   - Organization: `tsrx-org`
   - Repository: `tsrx`
   - Entity type: Environment
   - Environment: `vscode-marketplace`
   - Issuer: `https://token.actions.githubusercontent.com`
   - Audience: `api://AzureADTokenExchange`
   - Subject:
     `repo:tsrx-org@284757011/tsrx@1345339730:environment:vscode-marketplace`

   The numeric organization and repository IDs are GitHub's immutable OIDC subject
   format. Confirm the subject printed by `azure/login` before creating or
   replacing the federated credential if GitHub's OIDC configuration changes.

3. In the repository's `vscode-marketplace` environment, add these non-secret
   variables from the managed identity and Azure subscription:

   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`

   Restrict the environment's deployment branches to `main`.

4. Run the **Inspect VS Code Marketplace Identity** workflow. Copy the identity ID
   from its job summary.
5. In Visual Studio Marketplace publisher management, add that identity ID as a
   member of publisher `TSRX` with the Contributor role.
6. Rerun **Inspect VS Code Marketplace Identity** with **Verify publisher**
   enabled. This runs `vsce verify-pat --azure-credential TSRX` without publishing
   an extension.
7. Run **Publish VSC Extension (Manual)** from `main` and verify the resulting
   `TSRX.tsrx-vscode-plugin` listing before relying on version-triggered
   publishing.

Microsoft's current setup reference is
[Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#_secure-automated-publishing-to-visual-studio-marketplace).
