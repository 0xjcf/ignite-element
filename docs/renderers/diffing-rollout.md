# Diffing Renderer Rollout Notes

- Default: auto-diff enabled (config `strategy` optional). Use `strategy: "replace"` to force legacy replace-all globally.
- Per-component opt-out: `data-ignite-nodiff` or denylist; `data-ignite-hydrated` forces replace/hydrate.
- Fallback: child reorder/removal without keys triggers replace; logging controlled via `logging: "warn" | "debug"`.
- Opt-out registry: `registerNoDiffDenylistTag(tag)` to force replace for specific tags; keep empty unless needed.
- Tests/QA: caret/IME preserved, handlers updated by ref, reorder fallback covered; bench parity on 50 inputs.
