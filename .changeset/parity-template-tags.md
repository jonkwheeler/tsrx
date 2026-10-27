---
'@tsrx/core': patch
---

A `<style>` body now ends at a closing tag with whitespace before its `>` (`</style >`, or `</style` and `>` on the next line), as JSX allows and as a `<script>` body already does. Before, the element was reported as unclosed.

An element closed by a fragment's closing tag (`<b>x</>`) now reports `Expected '</b>' but found '</>'`, where the message said `found '</null>'`.
