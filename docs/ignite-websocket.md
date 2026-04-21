# 🔥 ignite-websocket

> **Behavior-first WebSocket integration for ignite-element + adapter contracts**

`ignite-websocket` provides a **behavior-first, state-machine–driven** way to work with WebSockets in the ignite ecosystem.

It separates:

* **connection and protocol behavior** (state machines)
* from **IO and transport mechanics** (WebSocket adapters)
* and assembles clean, declarative state into UI via **ignite-element**

---

## ✨ What ignite-websocket Is

ignite-websocket is **not** a UI library and not a networking abstraction.

It is:

* A **behavior layer** for real-time, event-driven systems
* A safe way to model WebSocket lifecycles
* A replacement for ad-hoc socket logic in components
* A first-class companion to ignite-element

ignite-websocket helps you build:

* chat systems
* real-time dashboards
* multiplayer state
* streaming updates
* collaborative apps

---

## ❌ What ignite-websocket Is NOT

ignite-websocket does **not**:

* Render UI
* Replace the WebSocket API
* Decide UX in callbacks
* Hide protocol behavior in effects
* Manage application state globally

If you just want `new WebSocket(url)` in a component, you don’t need ignite-websocket.

If you care about **correct real-time behavior**, you probably do.

---

## 🧠 Core Philosophy

> **State machines decide behavior.
> Adapters handle transport.
> ignite-element assembles projected state and commands for the UI.**

This keeps real-time logic:

* explicit
* inspectable
* testable
* reusable

---

## 🏗️ Architecture Overview

```txt
WebSocket State Machine (XState)
              ↓
        ignite-websocket
              ↓
        WebSocket API
              ↓
           Network
```

* **Machines** model connection state, retries, protocol rules
* **Adapters** own the actual socket
* **ignite-element** assembles projected state + commands
* **Bindings** render only

---

## 📦 Package Structure

```text
ignite-websocket/
  adapters/
    websocket.ts
  machines/
    connectionMachine.ts
  helpers/
    createWebSocketActor.ts
  types.ts
```

* **Adapters** wrap the WebSocket API
* **Machines** define connection behavior
* **Helpers** provide ergonomic APIs
* **Types** define snapshots and events

---

## 🔌 WebSocket Adapter (IO Layer)

Adapters are thin wrappers around the native WebSocket API.

They are responsible for:

* Opening and closing the socket
* Sending raw messages
* Receiving and normalizing messages
* Emitting **snapshots**

Adapters do **not**:

* Decide reconnection strategy
* Encode protocol rules
* Handle UX decisions

Adapters emit **events and snapshots**, not side effects.

---

## 📸 Snapshot Shape (Example)

```ts
export interface WebSocketSnapshot {
  status: "idle" | "connecting" | "connected" | "disconnected" | "error";
  lastMessage: unknown | null;
  error?: string;
}
```

ignite-element and machines only ever see snapshots — never raw sockets.

---

## 🎭 State Machines (Behavior Layer)

ignite-websocket ships **reference XState machines** for WebSocket behavior.

### Connection behavior includes

* idle → connecting → connected → disconnected → error
* reconnect with backoff
* explicit close vs network failure
* protocol-level message routing

Machines are:

* deterministic
* serializable
* fully testable
* replaceable by the user

---

## 🚀 Quick Start

```ts
import { createWebSocketActor } from "ignite-websocket";

const socketActor = createWebSocketActor({
  url: "wss://example.com/socket",
});
```

Project into UI with **ignite-element**:

```ts
igniteCore({
  source: socketActor,
});
```

---

## 🚀 End-to-End Example (igniteCore + Web Component)

### 1️⃣ Create the WebSocket Actor

```ts
import { createWebSocketActor } from "ignite-websocket";

export const socketActor = createWebSocketActor({
  url: "wss://example.com/socket",
});
```

---

### 2️⃣ Project UI State + Commands with `igniteCore`

```ts
import { igniteCore } from "ignite-element/xstate"; // DOM authoring over shared contracts

const socketComponent = igniteCore({
  source: socketActor,

  view: ({ snapshot }) => ({
    mode: snapshot.status,
    lastMessage: snapshot.lastMessage,
    errorMessage: snapshot.error ?? null,
  }),

  commands: ({ actor }) => ({
    connect: () => actor.send({ type: "CONNECT" }),
    disconnect: () => actor.send({ type: "DISCONNECT" }),
    send: (payload: unknown) =>
      actor.send({ type: "SEND", payload }),
  }),
});
```

---

### 3️⃣ Define the Web Component (ignite-jsx)

```ts
socketComponent(
  "socket-panel",
  ({ mode, lastMessage, errorMessage, connect, disconnect, send }) => {
    switch (mode) {
      case "idle":
        return <button onClick={() => connect()}>Connect</button>;

      case "connecting":
        return <p>Connecting…</p>;

      case "connected":
        return (
          <div>
            <p>Connected</p>
            <button onClick={() => send("ping")}>Send Ping</button>
            <button onClick={() => disconnect()}>Disconnect</button>
            <pre>{JSON.stringify(lastMessage)}</pre>
          </div>
        );

      case "error":
        return <p>Error: {errorMessage}</p>;
    }
  },
);
```

---

## 🧪 Testing

ignite-websocket is designed for deterministic testing:

* Use mock adapters
* Simulate network events
* Test machines without sockets
* Verify reconnect behavior safely

No real network required.

---

## 🎓 Why This Exists

Most WebSocket code today:

* lives in components
* mixes transport with behavior
* is hard to test
* fails under edge cases

ignite-websocket exists to:

* make real-time behavior explicit
* centralize protocol logic
* keep UI declarative
* scale real-time systems safely

---

## 🧭 When to Use ignite-websocket

Use ignite-websocket when:

* You need long-lived connections
* Real-time updates matter
* Reconnect logic affects UX
* Protocol rules exist

If your app is request/response only, use **ignite-query** instead.

---

## 📌 Summary

* ignite-websocket models **real-time behavior**
* Adapters handle **transport**
* ignite-element assembles **state into UI**
* Bindings render **pure UI**

**Behavior is explicit.
Transport is replaceable.
UI stays simple.**
