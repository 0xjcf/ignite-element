---
"ignite-element": patch
"@ignite-element/adapters": patch
---

# Correct core acquisition and React projections

Keep borrowed shared adapters reusable after failed core preparation. Release
provisional per-element web resources when connection setup fails, preserving
the primary error and allowing reconnection. Preserve sparse arrays and
enumerable symbol keys in detached framework projections, and forward string
setter attributes such as `online` without confusing them with event callbacks.

Close an owned web factory source when initial adapter construction fails,
preserving the original setup error even if close fails. Headless factory and
borrowed-source shutdown remains caller-owned.
