# 🔥 ignite-query

> **Behavior-first server-state (data-time) integration for ignite-element + adapter contracts**

`ignite-query` integrates **query runtimes** (such as TanStack Query) into the ignite ecosystem by separating **behavior** from **IO**.

It is designed to model **data freshness over time** — not user identity, sessions, or capability.

ignite-query works with:

* **ignite-element** as the authoring and projection surface
* **ignite-core** contracts/utilities shared across the package family
* **ignite-renderer/jsx** or **ignite-renderer/lit** for rendering (optional)
* Web Components, Solid, React, or vanilla DOM

---

## ✨ What ignite-query Is

ignite-query is a **behavior layer for server data**.

It gives you:

* Explicit modeling of **loading, success, error, retry, and staleness**
* A clean bridge between **state machines** and **query runtimes**
* Predictable UX for data refresh and failure
* Adapter-based integration (TanStack Query by default)

ignite-query gives **server data** a brain.

---

## ❌ What ignite-query Is NOT

ignite-query does **not**:

* Model user identity or sessions
* Manage long-lived connections
* Represent capability or permissions
* Send transactions or side effects
* Replace Web3 providers or WebSockets
* Act as a global application store

If the question is **“Who is the user and what can they do?”**,
you want **ignite-web3**, not ignite-query.

---

## 🧠 Core Philosophy

> **ignite-query models *data over time*.**
> **ignite-web3 models *user capability over time*.**
> **ignite-element assembles projected behavior into UI on top of ignite-core contracts.**

This distinction is intentional.

* Queries answer: *“What is the value right now?”*
* Wallets answer: *“Can the user act right now?”*

---

## 🧭 When ignite-query vs ignite-web3 (Important)

You may fetch the *same data* in both systems — **by design**.

### Use ignite-query when data is

* cacheable
* refreshable
* display-oriented
* usable without an active session
* meaningful offline or read-only

Examples:

* ETH balance display
* Token lists
* NFT metadata
* Block / transaction history
* Indexed API responses

### Use ignite-web3 when data is

* tied to an active wallet session
* required to enable/disable user actions
* invalid when the wallet disconnects
* part of capability checks

Examples:

* “Can this user send a transaction?”
* Gas availability for a specific action
* Active chain / account identity

ignite-query and ignite-web3 are **complementary**, not redundant.

---

## 🏗️ Architecture Overview

```txt
Query State Machine (XState)
          ↓
      ignite-query
          ↓
   Query Runtime Adapter
          ↓
        Network
```

* **Machines** model data-time behavior
* **Adapters** talk to query runtimes
* **ignite-element** assembles projected UI state + commands
* **Bindings/renderers** render only

---

## 📦 Package Structure

```text
ignite-query/
  adapters/
    tanstack.ts      // default (@tanstack/query-core)
    simple.ts        // future minimal fetch adapter
  helpers/
    createQueryActor.ts
  types.ts
```

Adapters are **pluggable**.
ignite-query is about *query semantics*, not a specific library.

---

## 🔌 Query Adapters (IO Layer)

Adapters are thin wrappers around query runtimes.

They:

* Create and manage query observers
* Subscribe to result changes
* Emit **serializable snapshots**
* Expose imperative commands (refetch, invalidate)

They do **not**:

* Decide UX
* Encode business rules
* Own retry policy as behavior

---

## 📸 Snapshot Shape

ignite-query exposes **UI-safe snapshots**:

```ts
export interface QuerySnapshot<TData = unknown> {
  status: "idle" | "loading" | "success" | "error";
  data: TData | undefined;
  error: unknown;
  isFetching: boolean;
  updatedAt: number | null;
}
```

ignite-element and machines **never touch query internals**.

---

## 🎭 State Machines (Behavior Layer)

ignite-query is designed to be used with **XState machines** that interpret query snapshots.

Example behaviors:

* initial load vs background refresh
* retry UX
* stale data indicators
* optimistic UI transitions

Reference machines live in XState actors/machines or a future
**ignite-xstate/query** package.

---

## 🚀 End-to-End Example (igniteCore + Web Component)

This example shows **data-time behavior**, not session logic.

---

### 1️⃣ Create a Query Actor

```ts
import { createQueryActor } from "ignite-query";
import { createTanstackQueryAdapter } from "ignite-query/adapters";

export const usersActor = createQueryActor({
  adapter: createTanstackQueryAdapter({
    queryKey: ["users"],
    queryFn: fetchUsers,
  }),
});
```

---

### 2️⃣ Project UI State + Commands with `igniteCore`

```ts
import { igniteCore, matchState } from "ignite-element/xstate"; // DOM authoring over shared contracts

const usersCore = igniteCore({
  source: usersActor,

  view: ({ snapshot }) => ({
    mode: matchState(
      snapshot,
      {
        idle: "idle",
        loading: "loading",
        error: "error",
        success: "ready",
      },
      "idle",
    ),

    users: snapshot.context.data ?? [],
    isFetching: snapshot.context.isFetching,

    errorMessage:
      snapshot.context.status === "error"
        ? String(snapshot.context.error)
        : null,
  }),

  commands: ({ actor }) => ({
    refetch: () => actor.send({ type: "REFETCH" }),
    retry: () => actor.send({ type: "RETRY" }),
  }),
});
```

---

### 3️⃣ Define the Web Component (ignite-jsx)

```ts
usersCore(
  "users-panel",
  ({ mode, users, isFetching, errorMessage, refetch, retry }) => {
    switch (mode) {
      case "loading":
        return <p>Loading users…</p>;

      case "error":
        return (
          <div>
            <p>Error: {errorMessage}</p>
            <button onClick={() => retry()}>Retry</button>
          </div>
        );

      case "ready":
        return (
          <div>
            <ul>
              {users.map((u) => (
                <li>{u.name}</li>
              ))}
            </ul>

            <button
              disabled={isFetching}
              onClick={() => refetch()}
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        );
    }
  },
);
```

---

## 🧩 Using ignite-query with MobX or Redux

ignite-query is **XState-first**, but not XState-only.

### MobX

```ts
autorun(() => {
  usersStore.set(usersActor.getSnapshot().context);
});
```

### Redux

```ts
usersActor.subscribe((snapshot) => {
  dispatch(usersUpdated(snapshot.context));
});
```

You do **not** need to model fetch behavior in Redux or MobX.

> **Use XState where behavior matters.
> Project results where storage matters.**

---

## 🧪 Testing

Because ignite-query isolates behavior:

* Machines can be tested without a query runtime
* Adapters can be mocked
* UI can be snapshot-tested with fake state

No network required.

---

## 🧭 When to Use ignite-query

Use ignite-query when:

* Data freshness matters
* Retry and failure UX matters
* Background refresh is acceptable
* Data may exist without an active user session

If the behavior depends on **user capability**, use ignite-web3 instead.

---

## 📌 Summary

* ignite-query models **data-time behavior**
* ignite-web3 models **session-time capability**
* Adapters integrate query runtimes
* ignite-element assembles projected state + intent
* Bindings render declaratively

**ignite-query answers “What is the data?”
ignite-web3 answers “Who can do what?”**
