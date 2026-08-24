---
"@tsrx/core": patch
"@tsrx/language-server": patch
"@tsrx/typescript-plugin": patch
---

Remove deprecated Ripple-named compatibility aliases from the target-neutral
compiler and language tooling. Ripple remains supported as an explicitly
detected compiler target with target-gated runtime completions.
