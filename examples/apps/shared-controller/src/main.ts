import { createFakePorts } from "./fake-ports.js";
import { createOwner } from "./owner.js";
import { DensityElement } from "./web.js";

const fake = createFakePorts();
const owner = createOwner(
	{ account: "demo", epoch: "first-login" },
	fake.ports,
);
customElements.define("demo-density", DensityElement);
const host = document.querySelector("#views");
const transport = document.querySelector("#transport");
if (!host || !transport) throw new Error("Missing demo containers");
const first = new DensityElement();
const second = new DensityElement();
first.owner = owner;
second.owner = owner;
host.append(first, second);
let readIndex = 0;
let writeIndex = 0;
function control(label: string, run: () => void) {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.onclick = run;
	transport?.append(button);
}
control("Return comfortable query", () => {
	const result = fake.reads[readIndex];
	if (result) {
		readIndex++;
		result.resolve({ kind: "value", account: "demo", density: "comfortable" });
	}
});
control("Accept next write", () => {
	const write = fake.writes[writeIndex];
	if (write) {
		writeIndex++;
		write.result.resolve({ kind: "accepted", ...write.request });
	}
});
control("Reject next write", () => {
	const write = fake.writes[writeIndex];
	if (write) {
		writeIndex++;
		write.result.resolve({ kind: "rejected" });
	}
});
control("Advance deadline", () => fake.advance(5000));
control("Remove first view", () => first.remove());
control("End session", () => {
	first.remove();
	second.remove();
	owner.dispose();
});
