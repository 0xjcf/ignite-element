# This project enforces a **behavior-first, boundary-driven architecture**

All code must respect the boundaries below. Violations are considered bugs, even if the code “works”.

---

## 🧠 Core Philosophy

> **Behavior is deterministic.
> The world is nondeterministic.
> Boundaries exist to keep them apart.**

No code may collapse these boundaries.

---

## 🧱 Required Architectural Boundaries

### 1️⃣ Behavior Boundary (Actors & State Machines)

* All game logic, rules, permissions, and role behavior MUST live in:

  * **actors**
  * **state machines**
* Behavior:

  * MUST be deterministic
  * MUST be replayable from events
  * MUST NOT perform IO
  * MUST NOT call LLMs
  * MUST NOT touch browser APIs, timers, or randomness directly

**Allowed:**

* sending and handling events
* guards, actions, invariants
* deciding *what should happen*

**Forbidden:**

* `fetch`, `setTimeout`, `Date.now`, `Math.random`
* direct LLM calls
* direct tool execution
* reading from global stores

---

### 2️⃣ Adapter Boundary (Nondeterministic Reality)

* All interaction with the outside world MUST go through **adapters**:

  * backend APIs
  * persistence
  * randomness
  * time
  * LLMs / AI agents
  * tools (filesystem, network, etc.)

Adapters:

* MAY be nondeterministic
* MUST normalize outputs
* MUST emit **events** back to behavior
* MUST NOT decide game rules
* MUST NOT mutate authoritative state directly

**LLMs are adapters by default.**

---

### 3️⃣ Actor Authority Rule

* Each **role** (player, NPC, system, admin, AI assistant) must have:

  * a **single behavioral authority**
* Role-specific logic MUST NOT be implemented as:

  * one-off conditionals in UI
  * ad-hoc checks in adapters
  * scattered guards across components

**If a new role or feature adds “special cases”, introduce or extend an actor — do not patch callers.**

---

### 4️⃣ AI / LLM Integration Rules

* AI is **advisory**, never authoritative.
* LLM output:

  * MUST be validated
  * MUST be gated by a policy actor
  * MUST be converted into events
* AI MUST NOT:

  * change game state directly
  * grant permissions
  * advance the game loop
  * decide outcomes without behavior approval

**Pattern:**
Behavior → Intent Event → LLM Adapter → Structured Result → Policy Actor → Decision Event

---

### 5️⃣ Projection Boundary (ignite-core)

* UI MUST NOT:

  * inspect machine internals
  * branch on raw states
  * encode business rules
* All UI state MUST come from:

  * `igniteCore` projections
* Projections:

  * are total (no `undefined` UI state)
  * expose **meaning**, not mechanics
  * hide transitions and internals

---

### 6️⃣ UI & Rendering Boundary (ignite-element)

* Components:

  * render projected state only
  * send commands / intent events
  * NEVER implement game logic
* No ternaries or logic branching on state inside components
* No direct role checks inside UI
* No conditional rendering without a router / projection decision

---

### 7️⃣ Time & Lifecycle Rules

* Time is an architectural concern.
* Start, stop, cancel, retry MUST be explicit.
* No implicit async lifetimes.
* No overlapping requests without cancellation handling.
* Adapters own timing; actors decide relevance.

---

## 🚫 Hard Anti-Patterns (Do Not Introduce)

* “Just this once” role checks
* UI deciding permissions or outcomes
* LLMs deciding game events
* Shared global state coordinating roles
* Direct API calls inside behavior
* Randomness without an adapter
* Silent retries or hidden async loops

---

## 🛡️ Enforcement (Repo Map + Checks)

**Behavior (deterministic):**

* `src/sigil-machine.ts`, `src/actors/`, `src/create-character.ts`, `src/rarityFromCharacter.ts`
* Must not use browser APIs, timers, randomness, or IO.

**Adapters (nondeterministic reality):**

* `src/adapters/`, `src/bindings/`
* May use time, randomness, IO, and browser APIs, but must emit events.

**Bindings (environment):**

* `src/main.ts`, `src/entrypoints/cli.ts`, `src/core-bindings.ts`
* Wire behavior + adapters + projection to a specific runtime.

**Projections (igniteCore):**

* `src/core.ts`
* Only place that can interpret machine state for UI meaning.

**UI (ignite-element):**

* `src/*.tsx`
* Must only consume `core(...)` output and commands. No direct actor/machine imports.

**Quick checks:**

* Behavior purity: `rg -n "Math\\.random|Date\\.now|fetch|setTimeout|document|window" src/sigil-machine.ts src/actors src/create-character.ts src/rarityFromCharacter.ts`
* UI boundaries: `rg -n "sigil-machine|createActor|actor" src/*.tsx`

---

## ✅ How to Extend the System Correctly

When adding a feature:

1. Identify the **behavioral owner**
2. Add or extend an **actor**
3. Define events and invariants
4. Add adapters for IO / AI / tools
5. Gate nondeterministic outputs
6. Project meaning via `igniteCore`
7. Render declaratively via `ignite-element`

If you are unsure:

> **Stop and propose an actor + event model before writing code.**

---

## 🎯 Definition of “Done”

A feature is complete only if:

* behavior is centralized
* roles are explicit
* AI is gated
* time is owned
* UI is dumb
* state is replayable
* boundaries are respected

---

## Final Reminder

> **If code works but violates boundaries, it is incorrect.**

Follow this contract strictly.
