/**
 * Drift-proofing: the canonical neutral source types published by
 * `@actor-web/runtime` must stay assignable to the loose structural contract
 * this adapter accepts (the `ActorWeb*` types in ../adapters/ActorWebAdapter).
 *
 * The public `ActorWeb*` types stay self-contained on purpose:
 * - aliasing the imported types in the public surface would pull
 *   `@actor-web/runtime` into the shipped d.ts graph and force every consumer
 *   to resolve an OPTIONAL peer (TS2307 without it);
 * - the canonical contract is stricter (subscribeEvent / transportStatus /
 *   snapshot helpers are required) while ignite deliberately accepts barebones
 *   and foreign sources (all of those optional).
 *
 * So instead of replacing the hand-written contract, this file pins the
 * relationship: every REAL Actor-Web source satisfies ignite's contract. If
 * `@actor-web/runtime` drifts incompatibly, typecheck fails here.
 *
 * Compile-time only — `src/__tests__` is excluded from the build (see
 * tsconfig.json) and only included by tsconfig.typecheck.json, so nothing
 * here ships and the runtime peer stays truly optional.
 */
import type {
	ActorCommandSource,
	ActorEventSubscriptionOptions,
	ActorReadModelSource,
	ActorSourceSnapshot,
	ProjectionTransportStatus,
} from "@actor-web/runtime";
import type {
	ActorWebCommandSource,
	ActorWebEventSubscriptionOptions,
	ActorWebReadModelSource,
	ActorWebSourceSnapshot,
	ActorWebTransportStatus,
} from "../adapters/ActorWebAdapter";

type ShipmentContext = {
	shipmentId: string | null;
	status: "idle" | "created";
};
type ShipmentCommand =
	| { type: "CREATE_SHIPMENT"; shipmentId: string }
	| { type: "RESET_SHIPMENT" };
type ShipmentEmitted = { type: "SHIPMENT_CREATED"; shipmentId: string };

// Never invoked at runtime: tsc checks the assignments below; the build
// excludes this directory, so none of it is emitted.
declare const canonicalReadModel: ActorReadModelSource<
	ShipmentContext,
	ShipmentEmitted
>;
declare const canonicalCommandSource: ActorCommandSource<
	ShipmentContext,
	ShipmentCommand,
	ShipmentEmitted
>;
declare const canonicalSnapshot: ActorSourceSnapshot<ShipmentContext>;
declare const canonicalTransport: ProjectionTransportStatus;
declare const canonicalEventOptions: ActorEventSubscriptionOptions;

export function _canonicalSourcesSatisfyIgniteContract() {
	const readModel: ActorWebReadModelSource<
		ShipmentContext,
		ShipmentCommand,
		ShipmentEmitted
	> = canonicalReadModel;

	const commandSource: ActorWebCommandSource<
		ShipmentContext,
		ShipmentCommand,
		ShipmentEmitted
	> = canonicalCommandSource;

	const snapshot: ActorWebSourceSnapshot<ShipmentContext> = canonicalSnapshot;

	// Field-identical shapes — assert BOTH directions so a divergence in either
	// repo (added/removed/renamed fields) fails the build.
	const transport: ActorWebTransportStatus = canonicalTransport;
	const transportBack: ProjectionTransportStatus =
		undefined as unknown as ActorWebTransportStatus;

	const eventOptions: ActorWebEventSubscriptionOptions = canonicalEventOptions;
	const eventOptionsBack: ActorEventSubscriptionOptions =
		undefined as unknown as ActorWebEventSubscriptionOptions;

	return {
		readModel,
		commandSource,
		snapshot,
		transport,
		transportBack,
		eventOptions,
		eventOptionsBack,
	};
}
