# 🔥 ignite-web3

> **Session-oriented Web3 behavior for ignite-core + bindings**

`ignite-web3` provides **state-machine–driven Web3 session behavior** (wallets, accounts, chains, transactions) for applications built with **ignite-core** and environment bindings (like **ignite-element** for DOM).

Unlike data-fetching solutions, ignite-web3 models **long-lived identity and capability**, not request/response data.

---

## ✨ What ignite-web3 Is

ignite-web3 is a **behavior layer** for Web3 **sessions**, not a data layer.

It gives you:

* Canonical **wallet and transaction state machines**
* Explicit modeling of **connection, identity, and capability**
* Adapter-based integration with libraries like **viem** and **ethers**
* Deterministic handling of reconnects, chain changes, and failures
* Clean projection via **ignite-core**, with DOM binding via **ignite-element**

ignite-web3 focuses on **who the user is and what they can do** — not just what data is returned.

---

## ❌ What ignite-web3 Is NOT

ignite-web3 does **not**:

* Fetch arbitrary data
* Cache responses
* Replace REST or GraphQL
* Automatically retry in the background
* Hide user intent behind effects

If you are fetching balances or block data, use **ignite-query**.
If you are managing **wallet identity and transactions**, use **ignite-web3**.

---

## 🧠 Core Philosophy

> **ignite-query models data freshness.**
> **ignite-web3 models user capability.**

* Queries answer: *“What is the data?”*
* Wallets answer: *“Who is the user and what can they do?”*

This distinction is fundamental.

---

## 🏗️ Architecture Overview

```txt
Wallet / Transaction State Machine (XState)
                ↓
            ignite-web3
                ↓
         Web3 Provider Adapter
                ↓
        Ethereum / RPC Network
```

* **Machines** model session lifecycle and capability
* **Adapters** handle provider IO and events
* **igniteCore** projects session state + user actions
* **Bindings** render intent-driven UI (ignite-element for Web Components)

---

## 📦 Package Structure

```text
ignite-web3/
  adapters/
    viem.ts
    ethers.ts
  machines/
    walletMachine.ts
    transactionMachine.ts
  helpers/
    createWalletActor.ts
  types.ts
```

* **Adapters** talk to providers
* **Machines** define session behavior
* **Helpers** expose ergonomic entry points

---

## 🔌 Web3 Adapters (IO Layer)

Adapters wrap provider libraries and emit **session events**, not data.

They handle:

* Connecting and disconnecting wallets
* Listening for account and chain changes
* Sending transactions
* Reporting provider-level errors

Adapters do **not** decide:

* UX flows
* Retry behavior
* Authorization rules

---

## 🎭 State Machines (Behavior Layer)

ignite-web3 ships **reference XState machines** for Web3 sessions.

### Wallet behavior includes

* `idle → connecting → connected → error`
* Account identity tracking
* Chain changes
* Explicit reconnect and disconnect semantics

### Transaction behavior includes

* `idle → signing → pending → confirmed → failed`
* User-initiated retries
* Explicit error surfaces

These are **session states**, not data states.

---

## 🚀 End-to-End Example: Wallet Session + Transaction

This example shows something ignite-query **cannot** model:
a **user-owned session with explicit capability**.

---

### 1️⃣ Create the Wallet Actor

```ts
import { createWalletActor } from "ignite-web3";
import { createViemAdapter } from "ignite-web3/adapters";
import { mainnet } from "viem/chains";

export const walletActor = createWalletActor({
  adapter: createViemAdapter({
    chains: [mainnet],
  }),
});
```

This actor represents:

* whether the user is connected
* which address they control
* whether they are allowed to send transactions

---

### 2️⃣ Create the Wallet Component

```ts
import { igniteCore } from "ignite-element"; // DOM binding over ignite-core

const walletCore = igniteCore({
  source: walletActor,

  states: ({ snapshot, matchState }) => ({
    mode: matchState(
      {
        idle: "disconnected",
        connecting: "connecting",
        connected: "connected",
        error: "error",
      },
      "disconnected",
    ),

    address: snapshot.context.address,
    chainId: snapshot.context.chainId,
    errorMessage: snapshot.context.error ?? null,
  }),

  commands: ({ actor }) => ({
    connect: () => actor.send({ type: "CONNECT" }),
    disconnect: () => actor.send({ type: "DISCONNECT" }),
    sendTransaction: (tx) =>
      actor.send({ type: "SEND_TX", payload: tx }),
  }),
});
```

---

### 3️⃣ Define the Wallet Web Component

```ts
walletCore(
  "eth-wallet",
  ({ mode, address, connect, disconnect, sendTransaction }) => {
    if (mode !== "connected") {
      return (
        <button onClick={() => connect()}>
          Connect Wallet
        </button>
      );
    }

    return (
      <div>
        <p>Connected as {address}</p>

        <button
          onClick={() =>
            sendTransaction({ to: "0x…", value: "0.01 ETH" })
          }
        >
          Send Transaction
        </button>

        <button onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  },
);
```

---

## 🧩 How ignite-query Fits Alongside This

To fetch balances or block data, you **compose** a separate core:

* ignite-web3 → *who the user is*
* ignite-query → *what the data is*

They are siblings, not replacements.

```html
<eth-wallet></eth-wallet>
<eth-balance></eth-balance>
```

Session and data remain separate — as they should.

---

## 🧪 Testing

ignite-web3 is fully testable:

* Mock provider adapters
* Simulate chain changes
* Test transaction flows deterministically

No RPC required.

---

## 🧭 When to Use ignite-web3

Use ignite-web3 when:

* User identity matters
* Capability is explicit (can/cannot transact)
* Connection lifecycle affects UX
* Errors require user action

Use ignite-query when:

* You are fetching or refreshing data
* Caching and staleness matter
* Background retries are acceptable

---

## 📌 Summary

* ignite-web3 models **sessions and capability**
* ignite-query models **data freshness**
* ignite-core projects **behavior into UI**
* Components remain declarative

**ignite-web3 answers “Who can do what?”
ignite-query answers “What is the data?”**
