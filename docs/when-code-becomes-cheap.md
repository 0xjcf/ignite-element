# When Code Becomes Cheap, Architecture Becomes Everything

There was a time when writing code was the hard part.

You had to remember syntax.
You had to understand APIs.
You had to wire async logic carefully.

First it was nested callbacks—until you hit “callback hell.”
Then it was Promises—until they became hard to reason about.

Even now, with the elegance of `async/await` in modern JavaScript and TypeScript, the underlying complexity of asynchronous flow still demands respect.

That friction slowed us down just enough to think.

That constraint is gone now.

---

## The bottleneck moved

Today, generating code is easy.

Shockingly easy.

You can ask an AI to scaffold a feature, write a state machine, wire async calls, and “handle loading and error states.”

And it will do it. Quickly. Confidently.

But something subtle changed when that friction disappeared.

The hardest part of building software stopped being *writing the code itself*.

It became *understanding the system the code participates in*.

---

### This is where systems start to break

The cracks usually appear around async behavior.

You’ll see state machines that look reasonable at first glance:

```ts
createMachine({
  initial: "idle",
  states: {
    idle: {
      on: { LOAD: "loading" }
    },
    loading: {
      invoke: {
        src: () => fetch("/api/data").then(r => r.json()),
        onDone: { target: "success" },
        onError: { target: "error" }
      }
    },
    success: {},
    error: {}
  }
});
```

This code is valid.
It even looks *well-structured*.

But look closer.

That machine now knows about the network.
It depends on the browser.
It hides failure semantics inside an effect.
It can’t be replayed deterministically.

At some point, the machine stopped describing *behavior* and started executing *external interaction*.

That’s the fault line.

---

### State machines didn’t cause this

They just made it easier to hide.

Frameworks like XState didn’t create this problem.

They gave us a powerful language for modeling behavior—something the frontend ecosystem desperately needed.

What those frameworks can’t decide for developers is *where* side effects belong.

That architectural responsibility still lives with the people building the system.

---

### The insight that reshaped ignite

While building ignite, I kept running into the same feeling:

> “The logic is correct… so why does this system feel unstable?”

The answer wasn’t tooling.

It was responsibility.

I was mixing concerns that evolve at different speeds as if they were the same thing.

---

### The mental model I now design around

Eventually, it all came together as a single, clear idea:

**Behavior lives in state machines.**
**External interactions live behind adapters.**
**Projection and authoring live in ignite-element.**
**ignite-core stays contract-only.**

This isn’t a framework rule.

It’s a systems rule.

---

### Boundaries aren’t just separation — they assign responsibility

There’s another idea hiding inside this model.

In actor-based systems, boundaries aren’t just about isolation.
They’re how responsibility is assigned.

Once a boundary is drawn, the actor inside it becomes fully responsible for what happens there—and explicitly *not* responsible for anything outside it.

That refusal matters.

It’s what keeps responsibility from leaking as systems grow.

In the ignite package family, these boundaries are intentional.

The state machine boundary is responsible for behavior: rules, transitions, and invariants.
It is not responsible for IO, timing, or environment concerns.

The adapter boundary is responsible for interacting with external systems.
It is not responsible for making business decisions.

The projection boundary—`ignite-element`—is responsible for translating
internal state into meaning the UI and runtime can safely consume.
It is not responsible for behavior policy inside the machine or for external IO.

`ignite-core` stays smaller than that. It owns the contracts that make the
boundary possible: events, effects, render args, and adapter-neutral helpers.

And the environment/runtime layer is responsible for lifecycle and rendering.
It is not responsible for system logic.

Each boundary answers one question—and refuses all others.

That refusal is what gives the system clarity.

---

### What that looks like in practice

The machine becomes boring again—in a good way:

```ts
createMachine({
  initial: "idle",
  context: {
    data: null,
    error: null
  },
  states: {
    idle: {
      on: { LOAD: "loading" }
    },
    loading: {
      on: {
        DATA_LOADED: {
          target: "success",
          actions: assign({
            data: (_, event) => event.data,
            error: () => null
          })
        },
        FAILED: {
          target: "error",
          actions: assign({
            error: (_, event) => event.error
          })
        }
      }
    },
    success: {},
    error: {}
  }
});
```

No `fetch`.
No side effects.
Just behavior.

Something else—an adapter—deals with the messy world and reports facts back:

```ts
fetchData()
  .then((data) => {
    actor.send({ type: "DATA_LOADED", data });
  })
  .catch((error) => {
    actor.send({ type: "FAILED", error });
  });
```

The machine never calls this.
It only reacts to events.

---

### Projection is the missing layer

Most applications skip this step entirely.

`ignite-element` exists so the UI never has to reason about raw state or
transitions directly:

```ts
igniteCore({
  source: actor,

  view: ({ snapshot }) => ({
    mode: matchState(
      snapshot,
      {
        idle: "idle",
        loading: "loading",
        success: "ready",
        error: "error"
      },
      "idle"
    ),
    data: snapshot.context.data
  }),

  commands: ({ actor }) => ({
    load: () => actor.send({ type: "LOAD" })
  })
});
```

The UI doesn’t see internals.

It sees *meaning*.

---

### Where ignite-element fits

`ignite-core` is environment-agnostic and contract-only.

It knows nothing about the DOM, component registration, or runtime assembly.

`ignite-element` is the deliberate authoring layer on top.
It combines adapter integration, projections, DOM lifecycle, browser events, and
the headless runtime surface into one coherent contract.

That separation is intentional.

It’s what allows the same system to work in the browser, in workers, in tests, and in Node environments.

Only the host/runtime layer changes.

---

### Why this matters more now than ever

AI is excellent at generating code that *works*.

It is not good at understanding lifecycle, boundaries, invariants, or long-term consequences.

When code is cheap, bad boundaries become expensive.

Architecture stops being an optimization and becomes a form of protection.

A system with clear separation resists accidental complexity, makes misuse obvious, localizes failure, and stays testable under pressure.

That’s not about frameworks.

That’s about survival.

---

### Why XState still matters

It’s worth being explicit here.

XState remains one of the most important tools in the modern frontend ecosystem.

It gives us a rigorous language for behavior: explicit transitions, guards, invariants, and inspectable logic.

Nothing in this series is about replacing XState.

These patterns exist to help teams **use state machines more effectively at scale**.

XState provides the behavior foundation.
`ignite-element`, supported by `ignite-core` contracts and adapter boundaries,
provides the architectural context around it.

---

### This is the start of a new series

In this Patterns series, I’ll slow down and name the forces most of us already feel:

Why adapters exist.
Why messages scale better than shared state.
Why determinism matters.
Why projection and assembly are a missing layer.
Why dependency direction decides whether systems age gracefully or rot.

The ignite package family is one concrete implementation of these ideas.

The real goal is clearer thinking.

---

### Final thought

AI didn’t change how systems work.

It just removed the last excuse for not understanding them.
