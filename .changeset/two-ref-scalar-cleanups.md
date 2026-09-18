---
'@tsrx/runtime': patch
---

Reduce mount and cleanup overhead for `mergeRefs(a, b)`, including composed spread refs. Track the two cleanup steps directly instead of allocating a cleanup array on each mount, while preserving single-pass object-ref classification, callback and cleanup order, and thrown-error behavior.
