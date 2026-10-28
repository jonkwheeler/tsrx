---
'@tsrx/solid': patch
---

A static component used more than once now renders each time. The Solid target no longer hoists static JSX such as `<p class="b">plain</p>` to a module-level constant: in Solid, JSX evaluates to a DOM node, so the constant held one node that every use moved into place. `<Static />` twice rendered one `<p>`, and a static component in a three-row `@for` showed only in the last row. Static JSX now stays in place, and Solid's compiler still parses each template once and clones it per use (#1236).
