import { observe } from "./headless.js";
import type { Owner } from "./owner.js";
import type { Intent } from "./source.js";
export function mountDensity(host: HTMLElement, owner: Owner): () => void {
	const status = document.createElement("p");
	status.setAttribute("role", "status");
	const choices = (["comfortable", "compact"] as const).map((density) => {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = density;
		return { button, density };
	});
	const load = document.createElement("button");
	load.type = "button";
	load.textContent = "Load";
	const retry = document.createElement("button");
	retry.type = "button";
	retry.textContent = "Retry";
	let active = true;
	async function invoke(intent: Intent): Promise<void> {
		if (!active || owner.isDisposed()) return;
		try {
			if (intent.type === "choose")
				await owner.core.execute({ command: "choose", input: intent.density });
			else await owner.core.execute({ command: intent.type });
		} catch (error) {
			if (owner.isDisposed()) return; // Observation invalidated; not request cancellation.
			console.error("Density observation failed", error);
			if (active) status.textContent = "The view could not update. Reopen it.";
		}
	}
	for (const { button, density } of choices)
		button.onclick = () => {
			void invoke({ type: "choose", density });
		};
	load.onclick = () => {
		void invoke({ type: "check" });
	};
	retry.onclick = () => {
		void invoke({ type: "retry" });
	};
	const nodes = [status, ...choices.map((item) => item.button), load, retry];
	host.append(...nodes);
	let stop: () => void;
	try {
		stop = observe(owner.core, (state) => {
			status.textContent = state.message;
			load.disabled = !state.canCheck;
			retry.disabled = !state.canRetry;
			for (const { button, density } of choices) {
				button.disabled = !state.canChoose;
				button.setAttribute(
					"aria-pressed",
					String(state.confirmed === density),
				);
			}
		});
	} catch (error) {
		active = false;
		for (const node of nodes) node.remove();
		throw error;
	}
	return () => {
		active = false;
		stop();
		for (const node of nodes) node.remove();
	};
}
/** This element borrows the owner; the session core is never registered. */
export class DensityElement extends HTMLElement {
	#owner: Owner | undefined;
	#stop: (() => void) | undefined;
	set owner(owner: Owner) {
		this.disconnectedCallback();
		this.#owner = owner;
		if (this.isConnected) this.connectedCallback();
	}
	connectedCallback() {
		if (this.#owner && !this.#stop)
			this.#stop = mountDensity(this, this.#owner);
	}
	disconnectedCallback() {
		this.#stop?.();
		this.#stop = undefined;
	}
}
