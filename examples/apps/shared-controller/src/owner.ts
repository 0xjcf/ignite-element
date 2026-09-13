import { igniteCore } from "ignite-element/actor-web";
import {
	createController,
	type Density,
	type Ports,
	type Session,
} from "./controller.js";
import { adaptController } from "./source.js";
import { deriveStates } from "./states.js";

/** Once per application/session, outside React render. New login epoch => new owner. */
export function createOwner(session: Session, ports: Ports) {
	const controller = createController(Object.freeze({ ...session }), ports);
	const source = adaptController(controller);
	const core = igniteCore({
		source,
		states: (snapshot) => deriveStates(snapshot.context),
		commands: () => ({
			choose: (density: Density) => controller.choose(density),
			check: () => controller.check(),
			retry: () => controller.retry(),
		}),
	});
	const cleanup = (): unknown[] => {
		const errors: unknown[] = [];
		for (const release of [() => core.dispose(), () => controller.dispose()]) {
			try {
				release();
			} catch (error) {
				errors.push(error);
			}
		}
		return errors;
	};
	try {
		core.get("states");
	} catch (error) {
		const errors = cleanup();
		if (errors.length)
			throw new AggregateError(
				[error, ...errors],
				"Preparation failed; cleanup also reported errors.",
				{ cause: error },
			);
		throw error;
	}
	let disposed = false;
	return {
		core,
		source,
		observationCount: controller.observerCount,
		isDisposed: () => disposed,
		dispose() {
			if (disposed) return;
			disposed = true;
			const errors = cleanup();
			if (errors.length)
				throw new AggregateError(errors, "Owner cleanup failed.");
		},
	};
}
export type Owner = ReturnType<typeof createOwner>;
export type Core = Owner["core"];
