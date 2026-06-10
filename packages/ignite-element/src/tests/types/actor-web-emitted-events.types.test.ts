import { describe, expectTypeOf, it } from "vitest";
import type { ActorWebCommandSource } from "../../actor-web";
import { igniteCore } from "../../IgniteCore";

/**
 * E3 — the Emitted→Events typing thread. A source that declares a distinct
 * `Emitted` union surfaces those events on `on()` / `execute().events` with NO
 * manual type arguments on the `igniteCore` call (best consumer DX).
 */

type ShipmentContext = { shipmentId: string; status: string };
type ShipmentMessage = { type: "shipment.cancel"; shipmentId: string };
type ShipmentEmitted =
	| { type: "OUTCOME_RESOLVED"; outcome: string }
	| { type: "SHIPMENT_CREATED"; shipmentId: string };

declare const shipmentSource: ActorWebCommandSource<
	ShipmentContext,
	ShipmentMessage,
	ShipmentEmitted
>;

// Compile-time only: tsc checks this function body (including the
// `@ts-expect-error`), but it is never invoked at runtime — the source is a
// `declare const`, so executing igniteCore()/execute() would crash.
async function _typeAssertions() {
	// No igniteCore<...> type arguments and no `events:` map.
	const register = igniteCore({
		adapter: "actor-web",
		source: shipmentSource,
		view: ({ context }) => ({ id: context.shipmentId }),
		commands: ({ actor }) => ({
			cancel: (shipmentId: string) =>
				actor.send({ type: "shipment.cancel", shipmentId }),
		}),
	});

	// on() accepts emitted event names, with the payload typed to the member.
	register.on("OUTCOME_RESOLVED", (event) => {
		expectTypeOf(event.detail).toEqualTypeOf<{
			type: "OUTCOME_RESOLVED";
			outcome: string;
		}>();
	});
	register.on("SHIPMENT_CREATED", (event) => {
		expectTypeOf(event.detail).toEqualTypeOf<{
			type: "SHIPMENT_CREATED";
			shipmentId: string;
		}>();
	});

	// @ts-expect-error — a name that is neither declared nor emitted is rejected.
	register.on("NOT_AN_EVENT", () => {});

	// execute().events is typed to the emitted union (uniform { type, payload }).
	const result = await register.execute("cancel");
	expectTypeOf(result.events).toEqualTypeOf<
		Array<
			| {
					type: "OUTCOME_RESOLVED";
					payload: { type: "OUTCOME_RESOLVED"; outcome: string };
			  }
			| {
					type: "SHIPMENT_CREATED";
					payload: { type: "SHIPMENT_CREATED"; shipmentId: string };
			  }
		>
	>();
}

describe("actor-web emitted events flow into the runtime types (no manual typing)", () => {
	it("types on()/execute() from the source's Emitted union (compile-time)", () => {
		// The assertions live in _typeAssertions (checked by tsc, never run here).
		expectTypeOf(_typeAssertions).toBeFunction();
	});
});
