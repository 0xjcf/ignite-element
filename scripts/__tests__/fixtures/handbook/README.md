# Handbook consumer fixtures

These files are rendered directly in the handbook. Run `pnpm --filter docs-site check:primary` after building the packages to compile and execute them against locally packed public packages with `skipLibCheck: false`.

The runner assembles a web consumer from the toggle, Redux, MobX, and test modules. It copies `counter-core.ts` and `shared-counter.tsx` from `examples/frameworks/react` beside `react.test.tsx`. The native consumer combines `CounterScreen.tsx` with that same `counter-core.ts` and the existing native isolation fixture. These are separate web and native installations, not a single application.
