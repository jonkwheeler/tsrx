---
'@tsrx/content-mapper': patch
---

New opt-in mapper option, `verificationMappings` (off by default), for command-line checkers (#1081). With `true`, each transform result also has `verificationMappings`: the transform's own diagnostics segments as `[generatedStart, generatedLength, originalStart, originalLength]`, in generated order, with no selection, coalescing or whitespace extension, and with the zero-length points that mark a statement's or literal's start and end. A checker that runs TypeScript on the generated text can then map every diagnostic back exactly, through `@tsrx/content-mapper/mapper` alone. `mappings` and everything TypeScript 7 reads are unchanged, with or without the option.
