import type {
	ActorWebCommandSource,
	ActorWebSourceSnapshot,
} from "ignite-element/actor-web";
import type { Controller, Density, Snapshot } from "./controller.js";
export type Intent =
	| { type: "choose"; density: Density }
	| { type: "check" }
	| { type: "retry" };
/** Foreign structural source: translation only, with no Actor-Web runtime dependency. */
export function adaptController(
	controller: Controller,
): ActorWebCommandSource<Snapshot, Intent> {
	const snapshot = (): ActorWebSourceSnapshot<Snapshot> => {
		const context = controller.snapshot();
		return {
			address: "display-density",
			context,
			phase: "active",
			toJSON: () => context,
		};
	};
	return {
		address: "display-density",
		snapshot,
		subscribe: (listener) => controller.subscribe(() => listener(snapshot())),
		async send(intent) {
			switch (intent.type) {
				case "choose":
					return controller.choose(intent.density);
				case "check":
					return controller.check();
				case "retry":
					return controller.retry();
			}
		},
	};
}
