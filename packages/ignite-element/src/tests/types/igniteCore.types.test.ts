import type {
	ActorWebCommandActor as AdapterActorWebCommandActor,
	ActorWebCommandSource as AdapterActorWebCommandSource,
	ActorWebExtendedState as AdapterActorWebExtendedState,
	ActorWebReadModelSource as AdapterActorWebReadModelSource,
	ActorWebSource as AdapterActorWebSource,
} from "@ignite-element/adapters/actor-web";
import {
	command,
	commandMetadataSymbol,
	type IgniteAdapter,
} from "@ignite-element/core";
import { makeAutoObservable } from "mobx";
import { describe, expect, expectTypeOf, it } from "vitest";
import { createMachine, type EventFrom, setup } from "xstate";
import type {
	ActorWebCommandActor,
	ActorWebCommandSource,
	ActorWebExtendedState,
	IgniteDomBridge as ActorWebIgniteDomBridge,
	IgniteDomRoleExpectation as ActorWebIgniteDomRoleExpectation,
	IgniteStoryBehaviorTraceEntry as ActorWebIgniteStoryBehaviorTraceEntry,
	IgniteStorySnapshot as ActorWebIgniteStorySnapshot,
	IgniteStorySnapshotEvent as ActorWebIgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot as ActorWebIgniteStorySummarySnapshot,
	IgniteStoryTraceSnapshot as ActorWebIgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry as ActorWebIgniteStoryTraceSnapshotEntry,
	IgniteTestHelpers as ActorWebIgniteTestHelpers,
	ActorWebReadModelSource,
	ActorWebSource,
} from "../../actor-web";
import * as actorWebPublic from "../../actor-web";
import { igniteCore as igniteCoreActorWebEntrypoint } from "../../actor-web";
import type { MobxEvent } from "../../adapters/MobxAdapter";
import type { XStateSnapshot } from "../../adapters/XStateAdapter";
import { igniteCore } from "../../IgniteCore";
import type { AdapterPack } from "../../IgniteElementFactory";
import type {
	InferAdapterFromSource,
	ReduxInstanceConfig,
	IgniteCoreReturn as SharedIgniteCoreReturn,
} from "../../igniteCore/types";
import type {
	IgniteDomBridge as RootIgniteDomBridge,
	IgniteDomRoleExpectation as RootIgniteDomRoleExpectation,
	IgniteStoryBehaviorTraceEntry as RootIgniteStoryBehaviorTraceEntry,
	IgniteStorySnapshot as RootIgniteStorySnapshot,
	IgniteStorySnapshotEvent as RootIgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot as RootIgniteStorySummarySnapshot,
	IgniteStoryTraceSnapshot as RootIgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry as RootIgniteStoryTraceSnapshotEntry,
	IgniteTestHelpers as RootIgniteTestHelpers,
} from "../../index";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
} from "../../index";
import type {
	IgniteDomBridge as MobxIgniteDomBridge,
	IgniteDomRoleExpectation as MobxIgniteDomRoleExpectation,
	IgniteStoryBehaviorTraceEntry as MobxIgniteStoryBehaviorTraceEntry,
	IgniteStorySnapshot as MobxIgniteStorySnapshot,
	IgniteStorySnapshotEvent as MobxIgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot as MobxIgniteStorySummarySnapshot,
	IgniteStoryTraceSnapshot as MobxIgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry as MobxIgniteStoryTraceSnapshotEntry,
	IgniteTestHelpers as MobxIgniteTestHelpers,
} from "../../mobx";
import type {
	CommandContext,
	CommandMetadata,
	CommandWithMetadata,
	EmitFromEvents,
	EventDescriptor,
	IgniteSchemaValue,
	ReduxSliceCommandActor,
	ReduxStoreCommandActor,
	ViewContext,
} from "../../RenderArgs";
import type {
	IgniteDomBridge as ReduxIgniteDomBridge,
	IgniteDomRoleExpectation as ReduxIgniteDomRoleExpectation,
	IgniteStoryBehaviorTraceEntry as ReduxIgniteStoryBehaviorTraceEntry,
	IgniteStorySnapshot as ReduxIgniteStorySnapshot,
	IgniteStorySnapshotEvent as ReduxIgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot as ReduxIgniteStorySummarySnapshot,
	IgniteStoryTraceSnapshot as ReduxIgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry as ReduxIgniteStoryTraceSnapshotEntry,
	IgniteTestHelpers as ReduxIgniteTestHelpers,
} from "../../redux";
import { createAgentRuntime } from "../../runtime/agent";
import type {
	IgniteDomBridge,
	IgniteDomRoleExpectation,
	IgniteTestHelpers,
} from "../../testing";
import type {
	IgniteCommandCall,
	IgniteStoryBehaviorTraceEntry,
	IgniteStoryLifecycleEntry,
	IgniteStorySnapshot,
	IgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot,
	IgniteStoryTraceEntry,
	IgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry,
} from "../../types/agent";
import type {
	IgniteAgentCommandContract,
	IgniteAgentCommandSchema,
	IgniteAgentEventSchema,
} from "../../types/schema";
import type { InferStateAndEvent } from "../../utils/igniteRedux";
import type {
	IgniteCoreReturn as XStateIgniteCoreReturn,
	IgniteDomBridge as XStateIgniteDomBridge,
	IgniteDomRoleExpectation as XStateIgniteDomRoleExpectation,
	IgniteStoryBehaviorTraceEntry as XStateIgniteStoryBehaviorTraceEntry,
	IgniteStorySnapshot as XStateIgniteStorySnapshot,
	IgniteStorySnapshotEvent as XStateIgniteStorySnapshotEvent,
	IgniteStorySummarySnapshot as XStateIgniteStorySummarySnapshot,
	IgniteStoryTraceSnapshot as XStateIgniteStoryTraceSnapshot,
	IgniteStoryTraceSnapshotEntry as XStateIgniteStoryTraceSnapshotEntry,
	IgniteTestHelpers as XStateIgniteTestHelpers,
} from "../../xstate";
import {
	igniteCore as igniteCoreXState,
	test as xstateTest,
} from "../../xstate";
import counterStore, { counterSlice } from "../fixtures/reduxCounterStore";

type RemovedRootProjectionExports = [
	// @ts-expect-error projection documents are internal and inference-only
	import("../../index").ProjectionDocument,
	// @ts-expect-error projection patches are internal and inference-only
	import("../../index").ProjectionDocumentPatch,
	// @ts-expect-error speech requests are internal and inference-only
	import("../../index").ProjectionSpeechRequest,
	// @ts-expect-error opaque targets are available only through inference
	import("../../index").IgniteProjectionTarget,
	// @ts-expect-error disposable sessions are available only through inference
	import("../../index").IgniteProjectionSession,
];

type RemovedAdapterProjectionExports = [
	// @ts-expect-error xstate projection data is not a named public export
	import("../../xstate").ProjectionDocument,
	// @ts-expect-error redux projection data is not a named public export
	import("../../redux").ProjectionDocument,
	// @ts-expect-error mobx projection data is not a named public export
	import("../../mobx").ProjectionDocument,
	// @ts-expect-error actor-web projection data is not a named public export
	import("../../actor-web").ProjectionDocument,
];

type ActorWebShipmentContext = {
	shipmentId: string | null;
	status: "idle" | "created";
};

type ActorWebShipmentCommand =
	| { type: "CREATE_SHIPMENT"; shipmentId: string }
	| { type: "RESET_SHIPMENT" };

type ActorWebShipmentEvent = {
	type: "SHIPMENT_CREATED";
	shipmentId: string;
};

const actorWebShipmentSource: ActorWebCommandSource<
	ActorWebShipmentContext,
	ActorWebShipmentCommand,
	ActorWebShipmentEvent
> = {
	address: "actor://server/logistics-shipment",
	snapshot: () => ({
		address: actorWebShipmentSource.address,
		context: {
			shipmentId: null,
			status: "idle",
		},
		phase: "idle",
		toJSON: () => ({}),
	}),
	subscribe: () => () => {},
	transportStatus: () => ({
		state: "connected",
		updatedAt: 1,
	}),
	subscribeTransportStatus: () => () => {},
	send: async () => {},
	ask: async <Response = unknown>() => 1 as Response,
};

const actorWebShipmentReadModelSource: ActorWebReadModelSource<
	ActorWebShipmentContext,
	ActorWebShipmentCommand,
	ActorWebShipmentEvent
> = {
	address: actorWebShipmentSource.address,
	snapshot: () => ({
		address: actorWebShipmentSource.address,
		context: {
			shipmentId: null,
			status: "idle",
		},
		phase: "idle",
		status: "idle",
		value: "idle",
		matches: (state) => state === "idle",
		can: (event) =>
			(typeof event === "string" ? event : event.type) === "CREATE_SHIPMENT",
		hasTag: (tag) => tag === "ready",
		toJSON: () => ({}),
	}),
	subscribe: () => () => {},
	transportStatus: actorWebShipmentSource.transportStatus,
	subscribeTransportStatus: () => () => {},
	close: () => {},
};

const actorWebShipmentFactory = () => actorWebShipmentSource;
const actorWebShipmentHostFactory = (_context: { host?: HTMLElement }) =>
	actorWebShipmentSource;
const actorWebShipmentReadModelHostFactory = (_context: {
	host?: HTMLElement;
}) => actorWebShipmentReadModelSource;
const actorWebShipmentDefaultedHostFactory = (
	_context: { host?: HTMLElement } = {},
) => actorWebShipmentSource;
const mobxCounterFactory = () =>
	makeAutoObservable({
		count: 0,
		increment() {
			this.count += 1;
		},
	});

describe("igniteCore type inference", () => {
	it("uses renderer arguments for unmarked callable factories", () => {
		type RendererArgs = {
			customValue: string;
		};
		type UnmarkedFactory = (
			elementName: string,
			renderer: (args: RendererArgs) => string,
		) => void;
		type MarkedArgs = {
			markedValue: number;
		};
		type MarkedFactory = UnmarkedFactory & {
			readonly __igniteRenderArgs?: MarkedArgs | undefined;
		};

		expectTypeOf<AdapterPack<UnmarkedFactory>>().toEqualTypeOf<RendererArgs>();
		expectTypeOf<AdapterPack<MarkedFactory>>().toEqualTypeOf<MarkedArgs>();
	});

	it("accepts only first-party branded projection targets on the one-argument overload", () => {
		expectTypeOf<RemovedRootProjectionExports>().toBeArray();
		expectTypeOf<RemovedAdapterProjectionExports>().toBeArray();
		const machine = setup({
			types: {
				context: {} as { count: number },
				events: {} as { type: "INC" },
			},
		}).createMachine({
			context: { count: 0 },
			initial: "active",
			states: {
				active: {
					on: {
						INC: {
							actions: () => undefined,
						},
					},
				},
			},
		});
		const counter = igniteCore({
			source: machine,
			view: ({ snapshot }) => ({ count: snapshot.context.count }),
		});
		type CounterParameters = Parameters<typeof counter>;
		expectTypeOf<CounterParameters["length"]>().toEqualTypeOf<2>();
		expectTypeOf<CounterParameters[0]>().toEqualTypeOf<string>();

		const documentTarget = createProjectionDocumentTarget({
			commitDocument: () => undefined,
		});
		const speechTarget = createProjectionSpeechTarget({
			commitSpeech: () => undefined,
			acknowledgeCommandName: "acknowledgeSpeech",
		});

		type DocumentTarget = ReturnType<typeof createProjectionDocumentTarget>;
		type SpeechTarget = ReturnType<typeof createProjectionSpeechTarget>;
		type DocumentTargetExposesConfiguration =
			"commitDocument" extends keyof DocumentTarget
				? true
				: "documentId" extends keyof DocumentTarget
					? true
					: false;
		type SpeechTargetExposesConfiguration =
			"commitSpeech" extends keyof SpeechTarget
				? true
				: "acknowledgeCommandName" extends keyof SpeechTarget
					? true
					: "resolveAcknowledgePayload" extends keyof SpeechTarget
						? true
						: false;
		expectTypeOf(documentTarget).toEqualTypeOf<DocumentTarget>();
		expectTypeOf(speechTarget).toEqualTypeOf<SpeechTarget>();
		expectTypeOf<DocumentTargetExposesConfiguration>().toEqualTypeOf<false>();
		expectTypeOf<SpeechTargetExposesConfiguration>().toEqualTypeOf<false>();
		const documentSession = counter(documentTarget);
		const speechSession = counter(speechTarget);
		try {
			expectTypeOf(documentSession.dispose).toEqualTypeOf<() => void>();
			expectTypeOf(speechSession.dispose).toEqualTypeOf<() => void>();
		} finally {
			documentSession.dispose();
			speechSession.dispose();
		}
		const assertInvalidOneArgumentUsage = (
			invalidCounter: typeof counter,
		): void => {
			// @ts-expect-error one-argument overload accepts only first-party targets
			invalidCounter("div");
		};
		void assertInvalidOneArgumentUsage;

		const plainTarget = {
			commitDocument: () => undefined,
		};
		const assertPlainTargetRejected = (
			invalidCounter: typeof counter,
		): void => {
			// @ts-expect-error plain objects are not valid projection targets
			invalidCounter(plainTarget);
		};
		void assertPlainTargetRejected;

		createProjectionDocumentTarget({
			// @ts-expect-error callback selectors are not part of the public target API
			selectDocument: () => null,
			commitDocument: () => undefined,
		});
	});

	it("accepts an EventTarget host for the headless agent runtime", () => {
		const adapter = {} as IgniteAdapter<
			{ count: number },
			{ type: "INCREMENT" }
		>;
		const runtime = createAgentRuntime({
			eventTypes: [],
			resolveInspection: (current) => ({
				snapshot: current.getSnapshot(),
				view: {},
			}),
			resolveRuntime: () => ({
				adapter,
				additionalArgs: {},
				host: new EventTarget(),
			}),
			resolveView: () => ({}),
		});

		void runtime;
	});

	it("re-exports IgniteCoreReturn from the xstate public entrypoint", () => {
		expectTypeOf<
			XStateIgniteCoreReturn<
				{ count: number },
				{ type: "PING" },
				{ count: number }
			>
		>().toEqualTypeOf<
			SharedIgniteCoreReturn<
				{ count: number },
				{ type: "PING" },
				{ count: number }
			>
		>();
	});

	it("exports story snapshot types from public entrypoints", () => {
		expectTypeOf<RootIgniteStoryBehaviorTraceEntry>().toEqualTypeOf<IgniteStoryBehaviorTraceEntry>();
		expectTypeOf<RootIgniteStorySnapshot>().toEqualTypeOf<IgniteStorySnapshot>();
		expectTypeOf<RootIgniteStorySnapshotEvent>().toEqualTypeOf<IgniteStorySnapshotEvent>();
		expectTypeOf<RootIgniteStorySummarySnapshot>().toEqualTypeOf<IgniteStorySummarySnapshot>();
		expectTypeOf<RootIgniteStoryTraceSnapshot>().toEqualTypeOf<IgniteStoryTraceSnapshot>();
		expectTypeOf<RootIgniteStoryTraceSnapshotEntry>().toEqualTypeOf<IgniteStoryTraceSnapshotEntry>();

		expectTypeOf<XStateIgniteStoryBehaviorTraceEntry>().toEqualTypeOf<IgniteStoryBehaviorTraceEntry>();
		expectTypeOf<XStateIgniteStorySnapshot>().toEqualTypeOf<IgniteStorySnapshot>();
		expectTypeOf<XStateIgniteStorySnapshotEvent>().toEqualTypeOf<IgniteStorySnapshotEvent>();
		expectTypeOf<XStateIgniteStorySummarySnapshot>().toEqualTypeOf<IgniteStorySummarySnapshot>();
		expectTypeOf<XStateIgniteStoryTraceSnapshot>().toEqualTypeOf<IgniteStoryTraceSnapshot>();
		expectTypeOf<XStateIgniteStoryTraceSnapshotEntry>().toEqualTypeOf<IgniteStoryTraceSnapshotEntry>();

		expectTypeOf<ReduxIgniteStoryBehaviorTraceEntry>().toEqualTypeOf<IgniteStoryBehaviorTraceEntry>();
		expectTypeOf<ReduxIgniteStorySnapshot>().toEqualTypeOf<IgniteStorySnapshot>();
		expectTypeOf<ReduxIgniteStorySnapshotEvent>().toEqualTypeOf<IgniteStorySnapshotEvent>();
		expectTypeOf<ReduxIgniteStorySummarySnapshot>().toEqualTypeOf<IgniteStorySummarySnapshot>();
		expectTypeOf<ReduxIgniteStoryTraceSnapshot>().toEqualTypeOf<IgniteStoryTraceSnapshot>();
		expectTypeOf<ReduxIgniteStoryTraceSnapshotEntry>().toEqualTypeOf<IgniteStoryTraceSnapshotEntry>();

		expectTypeOf<MobxIgniteStoryBehaviorTraceEntry>().toEqualTypeOf<IgniteStoryBehaviorTraceEntry>();
		expectTypeOf<MobxIgniteStorySnapshot>().toEqualTypeOf<IgniteStorySnapshot>();
		expectTypeOf<MobxIgniteStorySnapshotEvent>().toEqualTypeOf<IgniteStorySnapshotEvent>();
		expectTypeOf<MobxIgniteStorySummarySnapshot>().toEqualTypeOf<IgniteStorySummarySnapshot>();
		expectTypeOf<MobxIgniteStoryTraceSnapshot>().toEqualTypeOf<IgniteStoryTraceSnapshot>();
		expectTypeOf<MobxIgniteStoryTraceSnapshotEntry>().toEqualTypeOf<IgniteStoryTraceSnapshotEntry>();

		expectTypeOf<ActorWebIgniteStoryBehaviorTraceEntry>().toEqualTypeOf<IgniteStoryBehaviorTraceEntry>();
		expectTypeOf<ActorWebIgniteStorySnapshot>().toEqualTypeOf<IgniteStorySnapshot>();
		expectTypeOf<ActorWebIgniteStorySnapshotEvent>().toEqualTypeOf<IgniteStorySnapshotEvent>();
		expectTypeOf<ActorWebIgniteStorySummarySnapshot>().toEqualTypeOf<IgniteStorySummarySnapshot>();
		expectTypeOf<ActorWebIgniteStoryTraceSnapshot>().toEqualTypeOf<IgniteStoryTraceSnapshot>();
		expectTypeOf<ActorWebIgniteStoryTraceSnapshotEntry>().toEqualTypeOf<IgniteStoryTraceSnapshotEntry>();
		expectTypeOf<
			IgniteStorySnapshot["summary"]["finalSnapshot"]
		>().toEqualTypeOf<IgniteSchemaValue>();
		expectTypeOf<
			IgniteStorySnapshot["summary"]["finalView"]
		>().toEqualTypeOf<IgniteSchemaValue>();
	});

	it("exports DOM bridge testing types from public entrypoints", () => {
		expectTypeOf<RootIgniteDomBridge>().toEqualTypeOf<IgniteDomBridge>();
		expectTypeOf<RootIgniteDomRoleExpectation>().toEqualTypeOf<IgniteDomRoleExpectation>();
		expectTypeOf<RootIgniteTestHelpers>().toEqualTypeOf<IgniteTestHelpers>();

		expectTypeOf<XStateIgniteDomBridge>().toEqualTypeOf<IgniteDomBridge>();
		expectTypeOf<XStateIgniteDomRoleExpectation>().toEqualTypeOf<IgniteDomRoleExpectation>();
		expectTypeOf<XStateIgniteTestHelpers>().toEqualTypeOf<IgniteTestHelpers>();
		expectTypeOf(xstateTest.accessibilityBridge).toEqualTypeOf<
			IgniteTestHelpers["accessibilityBridge"]
		>();
		expectTypeOf(xstateTest.expectControls).toEqualTypeOf<
			IgniteTestHelpers["expectControls"]
		>();

		expectTypeOf<ReduxIgniteDomBridge>().toEqualTypeOf<IgniteDomBridge>();
		expectTypeOf<ReduxIgniteDomRoleExpectation>().toEqualTypeOf<IgniteDomRoleExpectation>();
		expectTypeOf<ReduxIgniteTestHelpers>().toEqualTypeOf<IgniteTestHelpers>();

		expectTypeOf<MobxIgniteDomBridge>().toEqualTypeOf<IgniteDomBridge>();
		expectTypeOf<MobxIgniteDomRoleExpectation>().toEqualTypeOf<IgniteDomRoleExpectation>();
		expectTypeOf<MobxIgniteTestHelpers>().toEqualTypeOf<IgniteTestHelpers>();

		expectTypeOf<ActorWebIgniteDomBridge>().toEqualTypeOf<IgniteDomBridge>();
		expectTypeOf<ActorWebIgniteDomRoleExpectation>().toEqualTypeOf<IgniteDomRoleExpectation>();
		expectTypeOf<ActorWebIgniteTestHelpers>().toEqualTypeOf<IgniteTestHelpers>();
	});

	it("keeps the actor-web public bridge limited to stable types plus igniteCore", () => {
		expect("createActorWebAdapter" in actorWebPublic).toBe(false);
		expectTypeOf<
			ActorWebSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>().toEqualTypeOf<
			AdapterActorWebSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>();
		expectTypeOf<
			ActorWebReadModelSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>().toEqualTypeOf<
			AdapterActorWebReadModelSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>();
		expectTypeOf<
			ActorWebCommandSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>().toEqualTypeOf<
			AdapterActorWebCommandSource<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>();
		expectTypeOf<
			ActorWebExtendedState<ActorWebShipmentContext>
		>().toEqualTypeOf<AdapterActorWebExtendedState<ActorWebShipmentContext>>();
		expectTypeOf<
			ActorWebCommandActor<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>().toEqualTypeOf<
			AdapterActorWebCommandActor<
				ActorWebShipmentContext,
				ActorWebShipmentCommand,
				ActorWebShipmentEvent
			>
		>();
	});

	it("infers actor-web view context, transport, and command actor facades", () => {
		const register = igniteCore({
			source: actorWebShipmentSource,
			view: ({ snapshot }) => ({
				status: snapshot.context.status,
				connected: snapshot.transport.state === "connected",
				snapshotStatus: snapshot.context.status,
			}),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;
		type Snapshot = ActorWebExtendedState<ActorWebShipmentContext>;
		type Actor = ActorWebCommandActor<
			ActorWebShipmentContext,
			ActorWebShipmentCommand,
			ActorWebShipmentEvent
		>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<
			RenderArgs["state"]["context"]
		>().toEqualTypeOf<ActorWebShipmentContext>();
		expectTypeOf<RenderArgs["state"]["transport"]>().toEqualTypeOf<
			Snapshot["transport"]
		>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: ActorWebShipmentCommand) => void
		>();
		expectTypeOf<RenderArgs["status"]>().toEqualTypeOf<
			ActorWebShipmentContext["status"]
		>();
		expectTypeOf<RenderArgs["connected"]>().toEqualTypeOf<boolean>();
		expectTypeOf<RenderArgs["snapshotStatus"]>().toEqualTypeOf<
			ActorWebShipmentContext["status"]
		>();
		expectTypeOf<RenderArgs["createShipment"]>().toEqualTypeOf<
			(shipmentId: string) => Promise<unknown>
		>();
		expectTypeOf<Actor["ask"]>().toEqualTypeOf<
			| (<Response = unknown>(
					message: ActorWebShipmentCommand,
					timeout?: number,
			  ) => Promise<Response>)
			| undefined
		>();
	});

	it("infers command actors from a single command-capable actor-web source", () => {
		const register = igniteCoreActorWebEntrypoint({
			source: actorWebShipmentSource,
			view: ({ snapshot }) => ({
				status: snapshot.context.status,
			}),
			commands: ({ actor, command }) => ({
				createShipment: command((shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
				),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			ActorWebExtendedState<ActorWebShipmentContext>
		>();
		expectTypeOf<RenderArgs["status"]>().toEqualTypeOf<
			ActorWebShipmentContext["status"]
		>();
		expectTypeOf<RenderArgs["createShipment"]>().toEqualTypeOf<
			CommandWithMetadata<
				(shipmentId: string) => Promise<unknown>,
				ActorWebExtendedState<ActorWebShipmentContext>
			>
		>();
		expectTypeOf<
			NonNullable<RenderArgs["createShipment"][typeof commandMetadataSymbol]>
		>().toEqualTypeOf<
			CommandMetadata<ActorWebExtendedState<ActorWebShipmentContext>>
		>();
	});

	it("infers actor-web read-model source snapshots from a single source", () => {
		const register = igniteCoreActorWebEntrypoint({
			source: actorWebShipmentReadModelHostFactory,
			view: ({ snapshot }) => ({
				shipmentId: snapshot.context.shipmentId,
				phase: snapshot.phase,
				status: snapshot.status,
				value: snapshot.value,
				idle: snapshot.matches?.("idle") ?? false,
				canCreate: snapshot.can?.({ type: "CREATE_SHIPMENT" }) ?? false,
				ready: snapshot.hasTag?.("ready") ?? false,
				snapshotShipmentId: snapshot.context.shipmentId,
			}),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			ActorWebExtendedState<ActorWebShipmentContext>
		>();
		expectTypeOf<
			RenderArgs["state"]["context"]
		>().toEqualTypeOf<ActorWebShipmentContext>();
		expectTypeOf<RenderArgs["state"]["phase"]>().toEqualTypeOf<string>();
		expectTypeOf<RenderArgs["state"]["status"]>().toEqualTypeOf<
			ActorWebShipmentContext["status"]
		>();
		expectTypeOf<RenderArgs["state"]["value"]>().toEqualTypeOf<unknown>();
		expectTypeOf<RenderArgs["state"]["matches"]>().toEqualTypeOf<
			((state: string) => boolean) | undefined
		>();
		expectTypeOf<RenderArgs["state"]["can"]>().toEqualTypeOf<
			((event: string | { type: string }) => boolean) | undefined
		>();
		expectTypeOf<RenderArgs["state"]["hasTag"]>().toEqualTypeOf<
			((tag: string) => boolean) | undefined
		>();
		expectTypeOf<RenderArgs["shipmentId"]>().toEqualTypeOf<string | null>();
		expectTypeOf<RenderArgs["idle"]>().toEqualTypeOf<boolean>();
		expectTypeOf<RenderArgs["canCreate"]>().toEqualTypeOf<boolean>();
		expectTypeOf<RenderArgs["ready"]>().toEqualTypeOf<boolean>();
		expectTypeOf<RenderArgs["createShipment"]>().toEqualTypeOf<
			(shipmentId: string) => Promise<unknown>
		>();
	});

	it("rejects a per-config commandSource — every adapter shares one source surface", () => {
		igniteCoreActorWebEntrypoint({
			source: actorWebShipmentSource,
			view: ({ snapshot }) => ({ status: snapshot.context.status }),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
			}),
			// @ts-expect-error commandSource was removed in beta.8 — the single
			// `source` provides both reads and writes, so actor-web shares the same
			// config surface as every other adapter. A read/write split, if ever
			// needed, lives in the source object, not a second igniteCore key.
			commandSource: () => actorWebShipmentSource,
		});
	});

	it("supports explicit actor-web factories, subpath entrypoints, and narrows omitted zero-arg factory inference", () => {
		const register = igniteCore({
			adapter: "actor-web",
			source: actorWebShipmentFactory,
			view: ({ snapshot }) => ({
				status: snapshot.context.status,
				connected: snapshot.transport.state === "connected",
			}),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;
		const defaultedHostSubpathRegister = igniteCoreActorWebEntrypoint<
			ActorWebShipmentContext,
			ActorWebShipmentCommand,
			ActorWebShipmentEvent
		>({
			source: actorWebShipmentDefaultedHostFactory,
			view: ({ snapshot }) => ({
				status: snapshot.context.status,
				connected: snapshot.transport.state === "connected",
			}),
			commands: ({ actor }) => ({
				createShipment: (shipmentId: string) =>
					actor.send({ type: "CREATE_SHIPMENT", shipmentId }),
			}),
		});
		const requiredHostSubpathRegister = igniteCoreActorWebEntrypoint<
			ActorWebShipmentContext,
			ActorWebShipmentCommand,
			ActorWebShipmentEvent
		>({
			source: actorWebShipmentHostFactory,
			view: ({ snapshot }) => ({
				status: snapshot.context.status,
				connected: snapshot.transport.state === "connected",
			}),
		});
		type DefaultedHostSubpathRenderArgs = AdapterPack<
			typeof defaultedHostSubpathRegister
		>;
		type RequiredHostSubpathRenderArgs = AdapterPack<
			typeof requiredHostSubpathRegister
		>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			ActorWebExtendedState<ActorWebShipmentContext>
		>();
		expectTypeOf<RenderArgs["createShipment"]>().toEqualTypeOf<
			(shipmentId: string) => Promise<unknown>
		>();
		expectTypeOf<
			DefaultedHostSubpathRenderArgs["state"]["transport"]
		>().toEqualTypeOf<
			ActorWebExtendedState<ActorWebShipmentContext>["transport"]
		>();
		expectTypeOf<
			RequiredHostSubpathRenderArgs["state"]["context"]
		>().toEqualTypeOf<ActorWebShipmentContext>();
		expectTypeOf<
			InferAdapterFromSource<typeof actorWebShipmentHostFactory>
		>().toEqualTypeOf<"actor-web">();
		// @ts-expect-error zero-arg actor-web factories no longer infer an adapter
		const omittedActorWebFactoryInference: InferAdapterFromSource<
			typeof actorWebShipmentFactory
		> = "actor-web";
		void omittedActorWebFactoryInference;
		// @ts-expect-error defaulted host-context factories compile to function.length 0
		const defaultedActorWebFactoryInference: InferAdapterFromSource<
			typeof actorWebShipmentDefaultedHostFactory
		> = "actor-web";
		void defaultedActorWebFactoryInference;
	});

	it("rejects omitted adapter inference for zero-arg redux and mobx factories", () => {
		const assertOmittedFactoryAdapters = () => {
			// @ts-expect-error zero-arg redux factories must specify adapter
			igniteCore({
				source: counterStore,
			});

			// @ts-expect-error zero-arg mobx factories must specify adapter
			igniteCore({
				source: mobxCounterFactory,
			});
		};

		void assertOmittedFactoryAdapters;

		igniteCore({
			adapter: "redux",
			source: counterStore,
		});
		igniteCore({
			adapter: "actor-web",
			source: actorWebShipmentDefaultedHostFactory,
		});
		igniteCore({
			adapter: "mobx",
			source: mobxCounterFactory,
		});
	});

	it("infers xstate snapshot and actor facades", () => {
		const machine = createMachine({
			context: { count: 0 },
			initial: "idle",
			states: {
				idle: {
					on: {
						INC: {
							actions: ({ context }) => ({
								context: { count: context.count + 1 },
							}),
						},
					},
				},
			},
		});

		type Machine = typeof machine;
		type Snapshot = XStateSnapshot<Machine>;

		const register = igniteCore({
			adapter: "xstate",
			source: machine,
			view: ({ snapshot }: { snapshot: Snapshot }) => ({
				double: snapshot.context.count * 2,
			}),
			commands: ({ actor }) => ({
				increment: () => actor.send({ type: "INC" }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: EventFrom<Machine>) => void
		>();
		expectTypeOf<RenderArgs["double"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers xstate types when adapter is omitted", () => {
		const machine = createMachine({
			context: { count: 1 },
			initial: "active",
			states: { active: {} },
		});

		type Machine = typeof machine;
		type Snapshot = XStateSnapshot<Machine>;

		const register = igniteCore({
			source: machine,
			view: ({ snapshot }: ViewContext<Snapshot>) => ({
				count: snapshot.context.count,
			}),
			commands: ({ actor }) => ({
				ping: () => actor.send({ type: "PING" }),
			}),
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<Snapshot>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: EventFrom<Machine>) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["ping"]>().toEqualTypeOf<() => void>();
	});

	it("types the effects emit helper based on declared events", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCoreXState({
			source: machine,
			events: (event) => ({
				"checkout-submitted": event<{ email: string }>(),
			}),
			commands: ({ actor }) => ({
				submit: () => {
					actor.send({ type: "PING" });
				},
			}),
			effects: ({ emit }) => {
				emit({
					type: "checkout-submitted",
					email: "user@example.com",
				});
			},
		});

		igniteCoreXState({
			source: machine,
			commands: ({ actor, command }) => ({
				noop: () => {
					void actor;
					void command;
				},
			}),
		});
	});

	it("keeps emit callable for payloads with widened type discriminants", () => {
		type ExternalEvents = {
			external: EventDescriptor<{ type: string; data: unknown }>;
		};

		const assertWidenedTypePayload = (emit: EmitFromEvents<ExternalEvents>) => {
			emit({ type: "external", data: { id: "evt-1" } });

			// @ts-expect-error - `data` is still required when the payload widens `type`
			emit({ type: "external" });
		};
		void assertWidenedTypePayload;
	});

	it("treats void event payloads as no-fields event members", () => {
		type VoidEvents = {
			heartbeat: EventDescriptor<void>;
		};

		const assertVoidPayload = (emit: EmitFromEvents<VoidEvents>) => {
			emit({ type: "heartbeat" });

			// @ts-expect-error - void event payloads do not accept member fields
			emit({ type: "heartbeat", id: "extra" });
		};
		void assertVoidPayload;
	});

	it("types effects emit when effects appear before events", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCoreXState({
			source: machine,
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: ({ emit }) => {
				emit({
					type: "leaderboardRefresh",
					tournamentId: "t-1",
					sort: "alpha",
				});
			},
			events: (event) => ({
				leaderboardRefresh: event<{
					tournamentId: string;
					sort: "alpha" | "beta";
				}>(),
			}),
		});
	});

	it("keeps effects emit typed for leaderboard workflows with events declared last", () => {
		type SortKey = "alpha" | "beta";

		const leaderboardMachine = createMachine({
			context: {
				tournaments: [] as { id: string }[],
				activeTournamentId: "t-1",
				sort: "alpha" as SortKey,
				leaderboard: [],
				joined: false,
				lastError: null as string | null,
				nextRefresh: undefined as number | undefined,
			},
			initial: "ready",
			states: {
				ready: {},
			},
		});

		igniteCoreXState({
			source: leaderboardMachine,
			view: ({ snapshot }) => ({
				leaderboard: snapshot.context.leaderboard,
				sort: snapshot.context.sort,
			}),
			commands: ({ actor }) => ({
				trigger: () => {
					actor.send({ type: "PING" });
				},
			}),
			effects: ({ snapshot, emit }) => {
				const { activeTournamentId, sort } = snapshot.context;
				emit({
					type: "leaderboardRefresh",
					tournamentId: activeTournamentId,
					sort,
				});
			},
			events: (event) => ({
				playerJoined: event<{ tournamentId: string }>(),
				playerLeft: event<{ tournamentId: string }>(),
				finalized: event<{ tournamentId: string }>(),
				leaderboardRefresh: event<{ tournamentId: string; sort: SortKey }>(),
			}),
		});
	});

	it("allows optional payload for effects events with undefined payload", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCoreXState({
			source: machine,
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: ({ emit }) => {
				emit({ type: "optional-payload" });
				emit({
					type: "optional-payload",
					id: "123",
				});
				emit({ type: "optional-payload" });
				emit({
					type: "required-payload",
					id: "123",
				});
			},
			events: (event) => ({
				"optional-payload": event<{ id?: string } | undefined>(),
				"required-payload": event<{ id: string }>(),
			}),
		});
	});

	it("infers effects events when adapter is inferred from source", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		igniteCoreXState({
			source: machine,
			events: (event) => ({
				"pinged-event": event<{ id: string }>(),
			}),
			commands: ({ actor }) => ({
				trigger: () => actor.send({ type: "PING" }),
			}),
			effects: ({ emit }) => {
				emit({
					type: "pinged-event",
					id: "123",
				});
				// @ts-expect-error - payload is required
				emit({ type: "pinged-event" });
			},
		});
	});

	it("rejects emit in command context", () => {
		const machine = createMachine({
			initial: "idle",
			states: {
				idle: {
					on: { PING: "idle" },
				},
			},
		});

		const assertNoCommandEmit = () => {
			igniteCore({
				source: machine,
				events: (event) => ({
					legacy: event<{ email: string }>(),
				}),
				commands: (
					// @ts-expect-error emit has been removed from command context
					{ emit },
				) => ({
					trigger: () => {
						void emit;
					},
				}),
			});
		};

		void assertNoCommandEmit;

		const assertNoCommandHost = () => {
			igniteCoreXState({
				source: machine,
				events: (event) => ({
					legacy: event<{ email: string }>(),
				}),
				commands: (
					// @ts-expect-error host has been removed from command context
					{ actor, host },
				) => ({
					trigger: () => {
						void actor;
						void host;
					},
				}),
			});
		};

		void assertNoCommandHost;
	});

	it("types the agent runtime surface", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];

		const register = igniteCore({
			adapter: "redux",
			source: store,
			view: ({ snapshot }: { snapshot: StoreState }) => ({
				count: snapshot.counter.count,
			}),
			commands: ({ actor }) => ({
				increment: (amount: number) =>
					actor.dispatch(counterSlice.actions.addByAmount(amount)),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
			}),
			effects: ({ snapshot, prevSnapshot, emit, select }) => {
				const count = select((state) => state.counter.count);
				expectTypeOf(count.current).toEqualTypeOf<number>();
				expectTypeOf(count.previous).toEqualTypeOf<number>();
				expectTypeOf(count.changed).toEqualTypeOf<boolean>();

				if (snapshot.counter.count === prevSnapshot.counter.count) {
					return;
				}

				emit({
					type: "counter-incremented",
					count: snapshot.counter.count,
				});
			},
		});

		const result = register.execute({ command: "increment", input: 2 });
		const schema = register.getSchema();
		expectTypeOf<Parameters<typeof register.execute>[0]>().toEqualTypeOf<
			IgniteCommandCall<{
				increment: (amount: number) => unknown;
			}>
		>();
		expectTypeOf(result).toEqualTypeOf<
			Promise<{
				snapshot: StoreState;
				events: Array<{
					type: "counter-incremented";
					count: number;
				}>;
			}>
		>();
		expectTypeOf(register.getView()).toEqualTypeOf<{ count: number }>();
		expectTypeOf(schema.commands).toEqualTypeOf<IgniteAgentCommandSchema>();
		expectTypeOf(schema.events).toEqualTypeOf<IgniteAgentEventSchema[]>();
		expectTypeOf(schema.snapshot).toEqualTypeOf<IgniteSchemaValue>();
		// getSchema().view carries the typed view projection (mirrors getView()),
		// not the loose IgniteSchemaValue that `snapshot` falls back to.
		expectTypeOf(schema.view).toEqualTypeOf<{ count: number }>();
		register.on("counter-incremented", (event) => {
			expectTypeOf(event).toEqualTypeOf<{
				type: "counter-incremented";
				count: number;
			}>();
		});
		register.watchSnapshot((state, prevState) => {
			expectTypeOf(state).toEqualTypeOf<StoreState>();
			expectTypeOf(prevState).toEqualTypeOf<StoreState>();
		});
		register.watchView((view, prevView) => {
			expectTypeOf(view).toEqualTypeOf<{ count: number }>();
			expectTypeOf(prevView).toEqualTypeOf<{ count: number }>();
		});

		const story = register.record("typed counter");
		const storyResult = story.execute({ command: "increment", input: 2 });
		expectTypeOf<Parameters<typeof story.execute>[0]>().toEqualTypeOf<
			IgniteCommandCall<{
				increment: (amount: number) => unknown;
			}>
		>();
		const storyView = story.until(
			(view) => view.count >= 4,
			() => {
				story.execute({ command: "increment", input: 1 });
			},
			{ maxSteps: 3 },
		);
		const storyTrace = story.trace();
		const storyLifecycle = story.lifecycle();
		const storySummary = story.summary();
		expectTypeOf(storyResult).toEqualTypeOf<
			Promise<{
				snapshot: StoreState;
				events: Array<{
					type: "counter-incremented";
					count: number;
				}>;
			}>
		>();
		expectTypeOf(storyView).toEqualTypeOf<Promise<{ count: number }>>();
		expectTypeOf(storyTrace).toEqualTypeOf<IgniteStoryTraceEntry[]>();
		expectTypeOf(storyLifecycle).toEqualTypeOf<IgniteStoryLifecycleEntry[]>();
		expectTypeOf(storySummary.finalSnapshot).toEqualTypeOf<StoreState>();
		expectTypeOf(storySummary.finalView).toEqualTypeOf<{ count: number }>();
		expectTypeOf(storySummary.events).toEqualTypeOf<
			Array<{ type: "counter-incremented"; count: number }>
		>();
		expectTypeOf(storySummary.commandCount).toEqualTypeOf<number>();
		expectTypeOf(storySummary.traceCount).toEqualTypeOf<number>();
		expectTypeOf(storySummary.lifecycleCount).toEqualTypeOf<number>();
		story.stop();

		const expectRuntimeValidation = () => {
			// @ts-expect-error - command name should be validated
			register.execute({ command: "incrementt", input: 2 });
			// @ts-expect-error - story command name should be validated
			story.execute({ command: "incrementt", input: 2 });
			// @ts-expect-error - positional execute overloads are removed
			register.execute("increment", 2);
			// @ts-expect-error - positional story execute overloads are removed
			story.execute("increment", 2);
			// @ts-expect-error - event name should be validated
			register.on("counter-incrementedd", () => {});
		};

		void expectRuntimeValidation;
	});

	it("rejects positional effects callbacks", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		const positionalEffects = (
			snapshot: StoreState,
			prevSnapshot: StoreState,
			context: { emit: () => void },
		) => {
			void snapshot;
			void prevSnapshot;
			void context;
		};

		const config = {
			adapter: "redux" as const,
			source: store,
			effects: positionalEffects,
		};

		const expectPositionalEffectsRejection = () => {
			// @ts-expect-error - v3 effects callbacks use the single object-form argument.
			const rejectedConfig: ReduxInstanceConfig<typeof store> = config;
			void rejectedConfig;
		};

		void expectPositionalEffectsRejection;
	});

	it("rejects source-provisioning wrappers and environment config on igniteCore", () => {
		const store = counterStore();

		const expectProvisioningSurfaceRejection = () => {
			const invalidFeatureConfig = {
				adapter: "redux",
				source: store,
				// @ts-expect-error - igniteCore consumes the exact source, not a wrapper
				feature: { source: store },
			} satisfies ReduxInstanceConfig<typeof store>;
			const invalidPortsConfig = {
				adapter: "redux",
				source: store,
				// @ts-expect-error - ports belong to application composition, not igniteCore
				ports: { clock: () => 1 },
			} satisfies ReduxInstanceConfig<typeof store>;
			const invalidDriverConfig = {
				adapter: "redux",
				source: store,
				// @ts-expect-error - driver is not an igniteCore composition surface
				driver: { name: "browser" },
			} satisfies ReduxInstanceConfig<typeof store>;
			const invalidEnvironmentConfig = {
				adapter: "redux",
				source: store,
				// @ts-expect-error - igniteEnvironment is not part of the public config
				igniteEnvironment: { document },
			} satisfies ReduxInstanceConfig<typeof store>;
			const invalidDisposalConfig = {
				adapter: "redux",
				source: store,
				// @ts-expect-error - disposal policy stays native to the source ecosystem
				onDispose: () => undefined,
			} satisfies ReduxInstanceConfig<typeof store>;

			void invalidFeatureConfig;
			void invalidPortsConfig;
			void invalidDriverConfig;
			void invalidEnvironmentConfig;
			void invalidDisposalConfig;
		};

		void expectProvisioningSurfaceRejection;
	});

	it("infers object-style xstate effects without core type imports", () => {
		const machine = setup({
			types: {
				context: {} as { count: number; ready: boolean },
				events: {} as { type: "INCREMENT" } | { type: "RESET" },
			},
		}).createMachine({
			initial: "active",
			context: {
				count: 0,
				ready: false,
			},
			states: {
				active: {
					on: {
						INCREMENT: {
							actions: ({ context }) => {
								context.count += 1;
								context.ready = context.count > 0;
							},
						},
						RESET: {
							actions: ({ context }) => {
								context.count = 0;
								context.ready = false;
							},
						},
					},
				},
			},
		});

		const register = igniteCoreXState({
			source: machine,
			view: ({ snapshot }) => ({
				count: snapshot.context.count,
				ready: snapshot.context.ready,
			}),
			commands: ({ actor, command }) => ({
				increment: () => {
					void command;
					actor.send({ type: "INCREMENT" });
				},
				reset: () => actor.send({ type: "RESET" }),
			}),
			events: (event) => ({
				"counter-incremented": event<{ count: number }>(),
				"ready-changed": event<{ ready: boolean }>(),
			}),
			effects: ({ snapshot, prevSnapshot, emit, select }) => {
				expectTypeOf(snapshot.context.count).toEqualTypeOf<number>();
				expectTypeOf(prevSnapshot.context.ready).toEqualTypeOf<boolean>();

				const count = select((state) => state.context.count);
				expectTypeOf(count.current).toEqualTypeOf<number>();
				expectTypeOf(count.previous).toEqualTypeOf<number>();
				expectTypeOf(count.changed).toEqualTypeOf<boolean>();

				emit({
					type: "counter-incremented",
					count: snapshot.context.count,
				});
				emit({
					type: "ready-changed",
					ready: snapshot.context.ready,
				});

				// @ts-expect-error - payload remains required
				emit({ type: "counter-incremented" });
				emit({
					// @ts-expect-error - event names remain constrained to declared events
					type: "counter-incrementedd",
					count: snapshot.context.count,
				});
			},
		});

		expectTypeOf(register.execute({ command: "increment" })).toEqualTypeOf<
			Promise<{
				snapshot: XStateSnapshot<typeof machine>;
				events: Array<
					| {
							type: "counter-incremented";
							count: number;
					  }
					| {
							type: "ready-changed";
							ready: boolean;
					  }
				>;
			}>
		>();

		const story = register.record("typed xstate authoring");
		expectTypeOf(story.execute({ command: "increment" })).toEqualTypeOf<
			Promise<{
				snapshot: XStateSnapshot<typeof machine>;
				events: Array<
					| {
							type: "counter-incremented";
							count: number;
					  }
					| {
							type: "ready-changed";
							ready: boolean;
					  }
				>;
			}>
		>();
		story.stop();
	});

	it("preserves command payload inference when metadata is attached", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				addByAmount: command(
					(amount: number) =>
						actor.dispatch(counterSlice.actions.addByAmount(amount)),
					{
						description: "Add a bounded amount to the counter.",
						input: command.number({ minimum: 1, maximum: 5 }),
					},
				),
			}),
		});

		void register.execute({ command: "addByAmount", input: 2 });
		const schema = register.getSchema();

		expectTypeOf(schema.commands).toEqualTypeOf<IgniteAgentCommandSchema>();

		const expectPayloadValidation = () => {
			// @ts-expect-error - wrapped command payload should remain numeric
			register.execute({ command: "addByAmount", input: "2" });
		};

		void expectPayloadValidation;
	});

	it("types command metadata through the exported metadata symbol", () => {
		const wrapped = command((amount: number) => amount, {
			description: "Return the provided amount.",
			input: command.number({ minimum: 1 }),
		});

		expectTypeOf(wrapped).toEqualTypeOf<
			CommandWithMetadata<(amount: number) => number>
		>();
		expectTypeOf(wrapped[commandMetadataSymbol]).toEqualTypeOf<
			CommandMetadata | undefined
		>();
	});

	it("types command canExecute metadata from the adapter snapshot", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				addWhenNonzero: command(
					(amount: number) =>
						actor.dispatch(counterSlice.actions.addByAmount(amount)),
					{
						description: "Add only after the count is nonzero.",
						canExecute: ({ snapshot }) => {
							expectTypeOf(snapshot.counter.count).toEqualTypeOf<number>();
							return snapshot.counter.count > 0;
						},
					},
				),
			}),
		});

		expectTypeOf(
			register.canExecute("addWhenNonzero"),
		).toEqualTypeOf<boolean>();

		const expectCommandNameValidation = () => {
			// @ts-expect-error - canExecute is typed to known command names
			register.canExecute("missing");
		};

		void expectCommandNameValidation;
	});

	it("types richer command metadata builders as object-shaped schema contracts", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => ({
				configureAlert: command(
					(payload: {
						label: string;
						enabled: boolean;
						priority: "low" | "high";
						channels: string[];
					}) =>
						actor.dispatch(
							counterSlice.actions.addByAmount(
								payload.enabled ? payload.channels.length : 0,
							),
						),
					{
						description: "Configure alert routing.",
						input: command.object(
							{
								label: command.string({ minLength: 1, maxLength: 40 }),
								enabled: command.boolean({ default: true }),
								priority: command.enum(["low", "high"], {
									default: "low",
								}),
								channels: command.array(command.string(), {
									minItems: 1,
								}),
							},
							{
								required: ["label", "enabled", "priority"],
							},
						),
					},
				),
			}),
		});

		const schema = register.getSchema();

		expectTypeOf(schema.commands).toEqualTypeOf<IgniteAgentCommandSchema>();
		expectTypeOf(
			schema.commands.configureAlert,
		).toEqualTypeOf<IgniteAgentCommandContract>();
		expectTypeOf(
			schema.commands.configureAlert.input,
		).toEqualTypeOf<IgniteSchemaValue>();
	});

	it("preserves tuple command inference when metadata is attached", () => {
		const store = counterStore();

		const register = igniteCore({
			adapter: "redux",
			source: store,
			commands: ({ actor, command }) => {
				const addPair = command(
					(first: number, second: number) =>
						actor.dispatch(counterSlice.actions.addByAmount(first + second)),
					{
						description: "Add a pair of values.",
					},
				);

				const tupleCommand: (first: number, second: number) => unknown =
					addPair;

				void tupleCommand;

				return {
					addPair,
				};
			},
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<Parameters<RenderArgs["addPair"]>>().toEqualTypeOf<
			[first: number, second: number]
		>();

		const expectTupleValidation = () => {
			const args = null as unknown as RenderArgs;
			// @ts-expect-error - wrapped command should preserve tuple arity
			args.addPair(1);
			// @ts-expect-error - wrapped command should preserve tuple item types
			args.addPair(1, "2");
		};

		void expectTupleValidation;
	});

	it("infers redux slice snapshot and actor facades", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceEvent = InferStateAndEvent<typeof counterSlice>["Event"];
		type SliceActor = ReduxSliceCommandActor<typeof counterSlice>;

		const viewCallback = ({ snapshot }: ViewContext<SliceState>) => ({
			count: snapshot.count,
		});
		const commandsCallback = ({ actor }: { actor: SliceActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: counterSlice,
			view: viewCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<SliceState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: SliceEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers redux slice types when adapter is omitted", () => {
		type SliceState = InferStateAndEvent<typeof counterSlice>["State"];
		type SliceContext = CommandContext<
			ReduxSliceCommandActor<typeof counterSlice>
		>;
		const sliceView = ({ snapshot }: ViewContext<SliceState>) => ({
			count: snapshot.count,
		});
		const sliceCommands = ({ actor }: SliceContext) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			source: counterSlice,
			view: sliceView,
			commands: sliceCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			InferStateAndEvent<typeof counterSlice>["State"]
		>();
	});

	it("infers redux store snapshot and actor facades", () => {
		const store = counterStore();
		type StoreInstance = typeof store;
		type StoreState = InferStateAndEvent<StoreInstance>["State"];
		type StoreEvent = InferStateAndEvent<StoreInstance>["Event"];
		type StoreActor = ReduxStoreCommandActor<StoreInstance>;

		const viewCallback = ({ snapshot }: ViewContext<StoreState>) => ({
			count: snapshot.counter.count,
		});
		const commandsCallback = ({ actor }: { actor: StoreActor }) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			adapter: "redux",
			source: store,
			view: viewCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<StoreState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: StoreEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers redux store types when adapter is omitted", () => {
		const store = counterStore();
		type StoreState = InferStateAndEvent<typeof store>["State"];
		type StoreContext = CommandContext<ReduxStoreCommandActor<typeof store>>;
		const storeStates = ({ snapshot }: ViewContext<StoreState>) => ({
			count: snapshot.counter.count,
		});
		const storeCommands = ({ actor }: StoreContext) => ({
			increment: () => actor.dispatch(counterSlice.actions.increment()),
		});

		const register = igniteCore({
			source: store,
			view: storeStates,
			commands: storeCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<
			InferStateAndEvent<typeof store>["State"]
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers mobx snapshot and actor facades", () => {
		const createStore = () =>
			makeAutoObservable({
				count: 0,
				increment() {
					this.count += 1;
				},
			});

		type StoreState = ReturnType<typeof createStore>;
		type StoreEvent = MobxEvent<StoreState>;

		const viewCallback = ({ snapshot }: ViewContext<StoreState>) => ({
			count: snapshot.count,
		});
		const commandsCallback = ({
			actor: storeInstance,
		}: {
			actor: StoreState;
		}) => ({
			increment: () => storeInstance.increment(),
		});

		const register = igniteCore({
			adapter: "mobx",
			source: createStore,
			view: viewCallback,
			commands: commandsCallback,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<StoreState>();
		expectTypeOf<RenderArgs["send"]>().toEqualTypeOf<
			(event: StoreEvent) => void
		>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});

	it("infers mobx types when adapter is omitted", () => {
		const sharedStore = makeAutoObservable({
			count: 0,
			increment() {
				this.count += 1;
			},
		});

		type SharedStore = typeof sharedStore;
		type SharedContext = CommandContext<SharedStore>;
		const sharedStates = ({ snapshot }: ViewContext<SharedStore>) => ({
			count: snapshot.count,
		});
		const sharedCommands = ({ actor: storeInstance }: SharedContext) => ({
			increment: () => storeInstance.increment(),
		});

		const register = igniteCore({
			source: sharedStore,
			view: sharedStates,
			commands: sharedCommands,
		});

		type RenderArgs = AdapterPack<typeof register>;

		expectTypeOf<RenderArgs["state"]>().toEqualTypeOf<typeof sharedStore>();
		expectTypeOf<RenderArgs["count"]>().toEqualTypeOf<number>();
		expectTypeOf<RenderArgs["increment"]>().toEqualTypeOf<() => void>();
	});
});
