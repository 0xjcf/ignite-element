---
"ignite-element": minor
"@ignite-element/renderer": minor
---

Stop applying `innerHTML`, `outerHTML`, and `srcdoc`. This is the `innerHTML` half of the planned content-prop deprecation, in this beta rather than the next major. `textContent` still renders and stays deprecated until that major release. Use JSX children for text, and hosts for trusted rich content.

`href`, `src`, `codebase`, `action`, `formaction`, and `xlink:href` accept only strings whose scheme passes the same executable-URL check projection documents already use. The attribute name is lowercased before that check, so `<object DATA>` and `<object Data>` use the same rule as `data`. `javascript:`, `vbscript:`, and HTML, SVG, or XHTML `data:` URLs are not applied. `script`, `iframe`, `frame`, `object`, and `embed` also reject every other `data:` URL, including `data:text/javascript` and an empty `data:`. `data:image/*` still applies on `img` and `source`. Other values, including `https:`, `mailto:`, and relative URLs, are. Non-string URL values are not applied. A later blocked URL on a reflected native property, including `iframe` `src`, `object` `data`, and `embed` `src`, is cleared by removing the attribute. The property is set to `undefined` only for a non-reflected custom-element property. `base` `href` is not applied.

String event-handler props are not applied in any case, including `ONCLICK`, `OnError`, and `xlink:onclick`. Function handlers still use `addEventListener` and do not create an attribute.

These sinks are not checked, so the no-host renderer stays within its gzip ceiling: `srcset` candidate lists, `poster`, SVG `animate`/`set` `to`/`values` when `attributeName` targets `href`, and `meta` refresh `content` URLs.

A JSX strategy `detach()` drops a shadow root that was queued before the style injector loaded, and it drops a pending root so reconnecting that host does not style it. `flushPendingStyles()` does not write into a root while that root is disconnected. A root that was connected when it was queued, then disconnected during a move, stays pending and is styled when it reconnects. The same reconnect applies when the style injector itself loads during the move. Roots that have not been connected yet still flush.

Development builds warn that `innerHTML`, `outerHTML`, and `srcdoc` are ignored and not applied. `textContent` still renders, and development builds still warn that it is deprecated until the next major release. A host `mount` may still assign `innerHTML`; that imperative callback is the escape hatch for trusted markup. Development builds also still log JSX replace fallbacks. Production and default builds omit those warnings and the fallback diagnostics, and they do not reference `process`.
