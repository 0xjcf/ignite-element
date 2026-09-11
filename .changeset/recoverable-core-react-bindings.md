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
