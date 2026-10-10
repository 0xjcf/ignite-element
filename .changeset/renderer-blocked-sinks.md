---
"ignite-element": minor
"@ignite-element/renderer": minor
---

Stop applying `innerHTML`, `outerHTML`, and `srcdoc`. This is the `innerHTML` half of the planned content-prop deprecation, in this beta rather than the next major. `textContent` still renders and stays deprecated until that major release. Use JSX children for text, and hosts for trusted rich content.

`href`, `src`, `action`, `formaction`, and `xlink:href` accept only strings whose scheme passes the same executable-URL check projection documents already use. `javascript:`, `vbscript:`, and HTML, SVG, or XHTML `data:` URLs are not applied. Other values, including `https:`, `mailto:`, and relative URLs, are. Non-string URL values are not applied.

Development builds warn when a sink is blocked. Production and default builds omit those warnings and do not reference `process`.
