import { html } from "lit-html";
import { IgniteElement, igniteElement } from "./IgniteElement";
import counterMachine from "./counterMachine";

igniteElement("my-counter", counterMachine, (state, send) => {
  return html`
    <span> ${state.context.count} </span>
    <button @click=${() => send({ type: "DEC" })}>-</button>
    <button @click=${() => send({ type: "INC" })}>+</button>
  `;
});

class Counter extends IgniteElement<typeof counterMachine> {
  constructor() {
    super(counterMachine);
  }

  protected render() {
    return html`
      <div @click=${() => this.send({ type: "DEC" })}>Counter...</div>
    `;
  }
}

customElements.define("another-counter", Counter);
