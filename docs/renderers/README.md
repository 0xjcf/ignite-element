# Renderer Defaults

Ignite Element ships with Ignite JSX as the default renderer. The normal v3 path is:

1. Set `jsxImportSource` to `ignite-element/jsx`.
2. Return JSX from your component render function.
3. Co-locate any component CSS with ordinary `<style>` tags.

## Default JSX path

```tsx
/** @jsxImportSource ignite-element/jsx */
component("ignite-counter", ({ count, increment }) => (
  <>
    <style>{`.counter { display: grid; gap: 0.5rem; }`}</style>
    <div className="counter">
      <button onClick={increment}>+</button>
      <span>{count}</span>
    </div>
  </>
));
```

The JSX renderer diffs ordinary rerenders by default, so stable nodes such as `<style>` tags are updated in place instead of being duplicated.

## More examples

See [Views](https://0xjcf.github.io/ignite-element/handbook/views/) for Ignite JSX, React and React Native examples.

## Diff vs. replace

- Diffing is the default for Ignite JSX.
- Set `strategy: "replace"` only when you intentionally want legacy replace behavior.
- Per-host opt-outs such as `data-ignite-nodiff`, hydrated roots, or denylisted hosts remain supported as compatibility escape hatches.
