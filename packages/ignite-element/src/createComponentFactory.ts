import type { IgniteAdapter, StateScope } from "@ignite-element/core";
import type {
	IgniteJsxChild,
	RenderStrategyFactory,
} from "@ignite-element/renderer";
import type { TemplateResult } from "lit-html";
import {
	type BaseAdapterFactory,
	createProjectionFactory,
	type ProjectionFactory,
	type ProjectionFactoryOptions,
	type ResolvedAdapterFactory,
	type StandardCommandActor,
	type WithFacadeRenderArgs,
} from "./createProjectionFactory";
import igniteElementFactory, {
	type BaseRenderArgs,
	type ComponentFactory,
} from "./IgniteElementFactory";
import type {
	EmitFromEvents,
	EmptyEventMap,
	EventMap,
	EventMember,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "./RenderArgs";

type AdditionalRenderArgs<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
> = Omit<RenderArgs, keyof BaseRenderArgs<State, Event>>;

export type ElementFactoryOptions<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
> = {
	scope?: StateScope;
	createAdditionalArgs?: (
		adapter: IgniteAdapter<State, Event>,
		host?: EventTarget,
	) => AdditionalRenderArgs<State, Event, RenderArgs>;
	createRenderStrategy?: RenderStrategyFactory<View>;
	eventTypes?: readonly (keyof Events & string)[];
	resolveView?: (
		adapter: IgniteAdapter<State, Event>,
	) => RuntimeView | Record<never, never>;
	resolveInspection?: (adapter: IgniteAdapter<State, Event>) => {
		snapshot: unknown;
		view: RuntimeView | Record<never, never>;
	};
	cleanup?: boolean;
};

export type ElementFactoryCreator<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View,
	Result,
	Events extends EventMap = EmptyEventMap,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
> = (
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	options: ElementFactoryOptions<
		State,
		Event,
		RenderArgs,
		View,
		Events,
		RuntimeView
	>,
) => Result;

export type ComponentFactoryOptions<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
> = ProjectionFactoryOptions<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	Events,
	HTMLElement
> & {
	createRenderStrategy?: RenderStrategyFactory<View>;
};

type ResolvedComponentFactoryOptions<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = Omit<
	ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
	"resolveStateSnapshot" | "resolveCommandActor"
> & {
	resolveStateSnapshot: (adapter: IgniteAdapter<State, Event>) => Snapshot;
	resolveCommandActor: (adapter: IgniteAdapter<State, Event>) => CommandActor;
};

type DefaultComponentFactoryOptions<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = Omit<
	ComponentFactoryOptions<
		State,
		Event,
		State,
		StatesResult,
		StandardCommandActor<State, Event>,
		CommandsResult,
		Additional,
		View,
		Events
	>,
	"resolveStateSnapshot" | "resolveCommandActor"
> & {
	resolveStateSnapshot?: never;
	resolveCommandActor?: never;
};

type IsExactly<Left, Right> = (<Value>() => Value extends Left
	? 1
	: 2) extends <Value>() => Value extends Right ? 1 : 2
	? (<Value>() => Value extends Right ? 1 : 2) extends <
			Value,
		>() => Value extends Left ? 1 : 2
		? true
		: false
	: false;

type UsesDefaultResolvers<State, Event, Snapshot, CommandActor> = IsExactly<
	State,
	Snapshot
> extends true
	? IsExactly<StandardCommandActor<State, Event>, CommandActor> extends true
		? true
		: false
	: false;

type ComponentFactoryResult<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = ComponentFactory<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events
	>,
	View
>;

type ComponentElementFactory<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
> = ElementFactoryCreator<
	State,
	Event,
	WithFacadeRenderArgs<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events
	>,
	View,
	Result,
	Events,
	StatesResult
>;

type BindProjectionToElementsOptions<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View,
	Result,
	Events extends EventMap = EmptyEventMap,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
> = {
	elementFactory?: ElementFactoryCreator<
		State,
		Event,
		RenderArgs,
		View,
		Result,
		Events,
		RuntimeView
	>;
	createRenderStrategy?: RenderStrategyFactory<View>;
	errorPrefix?: string;
};

const createDomEmit = <Events extends EventMap>(
	host: EventTarget,
): EmitFromEvents<Events> => {
	return <Type extends keyof Events & string>(
		event: EventMember<Events, Type>,
	) => {
		const { type, ...detail } = event;
		const customEvent = new CustomEvent(type, {
			detail,
			bubbles: true,
			composed: true,
		});
		host.dispatchEvent(customEvent);
	};
};

export function bindProjectionToElements<
	State,
	Event,
	RenderArgs extends BaseRenderArgs<State, Event>,
	View = TemplateResult | IgniteJsxChild,
	Result = ComponentFactory<State, Event, RenderArgs, View>,
	Events extends EventMap = EmptyEventMap,
	RuntimeView extends Record<string, unknown> = Record<never, never>,
>(
	projection: ProjectionFactory<
		State,
		Event,
		RenderArgs,
		HTMLElement,
		Events,
		RuntimeView
	>,
	options: BindProjectionToElementsOptions<
		State,
		Event,
		RenderArgs,
		View,
		Result,
		Events,
		RuntimeView
	> = {},
): Result {
	const elementFactory =
		options.elementFactory ??
		(igniteElementFactory as ElementFactoryCreator<
			State,
			Event,
			RenderArgs,
			View,
			Result,
			Events,
			RuntimeView
		>);
	const errorPrefix = options.errorPrefix ?? "bindProjectionToElements";

	return elementFactory(projection.createAdapter, {
		scope: projection.scope,
		cleanup: projection.cleanup,
		eventTypes: projection.eventTypes,
		resolveInspection: projection.resolveInspection,
		resolveView: projection.resolveView,
		createRenderStrategy: options.createRenderStrategy,
		createAdditionalArgs: (adapter, host) => {
			if (!host) {
				throw new Error(
					`[${errorPrefix}] Host element is required for projection.`,
				);
			}
			const renderHost = host as HTMLElement;
			return projection.createAdditionalArgs(
				adapter,
				renderHost,
				createDomEmit<Events>(host),
			);
		},
	});
}

type MetadataComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = [
	createAdapter: ResolvedAdapterFactory<
		State,
		Event,
		HTMLElement,
		Snapshot,
		CommandActor
	>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type ExplicitComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = [
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	options: ResolvedComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type DefaultComponentFactoryInvocation<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> = [
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	options?: DefaultComponentFactoryOptions<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type ComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
> =
	| MetadataComponentFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events
	  >
	| ExplicitComponentFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events
	  >
	| DefaultComponentFactoryInvocation<
			State,
			Event,
			StatesResult,
			CommandsResult,
			Additional,
			View,
			Events
	  >;

type MetadataRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
> = [
	createAdapter: ResolvedAdapterFactory<
		State,
		Event,
		HTMLElement,
		Snapshot,
		CommandActor
	>,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		Result
	>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type ExplicitRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
> = [
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		Result
	>,
	options: ResolvedComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type DefaultRendererFactoryInvocation<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
> = [
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		StandardCommandActor<State, Event>,
		CommandsResult,
		Additional,
		View,
		Events,
		Result
	>,
	options?: DefaultComponentFactoryOptions<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		View,
		Events
	>,
];

type RendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
> =
	| MetadataRendererFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events,
			Result
	  >
	| ExplicitRendererFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events,
			Result
	  >
	| DefaultRendererFactoryInvocation<
			State,
			Event,
			StatesResult,
			CommandsResult,
			Additional,
			View,
			Events,
			Result
	  >;

function isMetadataComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
>(
	invocation: ComponentFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): invocation is MetadataComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	View,
	Events
> {
	const createAdapter = invocation[0];
	return (
		"resolveStateSnapshot" in createAdapter &&
		typeof createAdapter.resolveStateSnapshot === "function" &&
		"resolveCommandActor" in createAdapter &&
		typeof createAdapter.resolveCommandActor === "function"
	);
}

function isExplicitComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
>(
	invocation: ComponentFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): invocation is ExplicitComponentFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	View,
	Events
> {
	const options = invocation[1];
	return (
		options !== undefined &&
		typeof options.resolveStateSnapshot === "function" &&
		typeof options.resolveCommandActor === "function"
	);
}

function isMetadataRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	invocation: RendererFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		Result
	>,
): invocation is MetadataRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	View,
	Events,
	Result
> {
	const createAdapter = invocation[0];
	return (
		"resolveStateSnapshot" in createAdapter &&
		typeof createAdapter.resolveStateSnapshot === "function" &&
		"resolveCommandActor" in createAdapter &&
		typeof createAdapter.resolveCommandActor === "function"
	);
}

function isExplicitRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	invocation: RendererFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		Result
	>,
): invocation is ExplicitRendererFactoryInvocation<
	State,
	Event,
	Snapshot,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	View,
	Events,
	Result
> {
	const options = invocation[2];
	return (
		options !== undefined &&
		typeof options.resolveStateSnapshot === "function" &&
		typeof options.resolveCommandActor === "function"
	);
}

function bindComponentFactory<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	projection: ProjectionFactory<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			Events
		>,
		HTMLElement,
		Events,
		StatesResult
	>,
	createRenderStrategy: RenderStrategyFactory<View> | undefined,
	elementFactory?: ElementFactoryCreator<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			Events
		>,
		View,
		Result,
		Events,
		StatesResult
	>,
): Result {
	return bindProjectionToElements(projection, {
		elementFactory,
		createRenderStrategy,
		errorPrefix: "createComponentFactory",
	});
}

function createMetadataComponentFactory<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	invocation: MetadataComponentFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
	elementFactory?: ElementFactoryCreator<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			Events
		>,
		View,
		Result,
		Events,
		StatesResult
	>,
): Result {
	const [createAdapter, options = {}] = invocation;
	const { createRenderStrategy, ...projectionOptions } = options;
	const projection = createProjectionFactory(createAdapter, {
		...projectionOptions,
		debugName: "createComponentFactory",
	});
	return bindComponentFactory(projection, createRenderStrategy, elementFactory);
}

function createExplicitComponentFactory<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown>,
	CommandActor,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	invocation: ExplicitComponentFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
	elementFactory?: ElementFactoryCreator<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			Events
		>,
		View,
		Result,
		Events,
		StatesResult
	>,
): Result {
	const [createAdapter, options] = invocation;
	const { createRenderStrategy, ...projectionOptions } = options;
	const projection = createProjectionFactory(createAdapter, {
		...projectionOptions,
		debugName: "createComponentFactory",
	});
	return bindComponentFactory(projection, createRenderStrategy, elementFactory);
}

function createDefaultComponentFactory<
	State,
	Event,
	StatesResult extends Record<string, unknown>,
	CommandsResult extends FacadeCommandResult,
	Additional extends Record<string, unknown>,
	View,
	Events extends EventMap,
	Result,
>(
	invocation: DefaultComponentFactoryInvocation<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		View,
		Events
	>,
	elementFactory?: ElementFactoryCreator<
		State,
		Event,
		WithFacadeRenderArgs<
			State,
			Event,
			StatesResult,
			StandardCommandActor<State, Event>,
			CommandsResult,
			Additional,
			Events
		>,
		View,
		Result,
		Events,
		StatesResult
	>,
): Result {
	const [createAdapter, options = {}] = invocation;
	const { createRenderStrategy, ...projectionOptions } = options;
	const projection = createProjectionFactory(createAdapter, {
		...projectionOptions,
		debugName: "createComponentFactory",
	});
	return bindComponentFactory(projection, createRenderStrategy, elementFactory);
}

/**
 * @internal Renderer-aware variant retained for internal composition. Not part
 * of the package export surface.
 */
export function createComponentFactoryWithRenderer<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactoryResult<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
>(
	createAdapter: ResolvedAdapterFactory<
		State,
		Event,
		HTMLElement,
		Snapshot,
		CommandActor
	>,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		FactoryResult
	>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): FactoryResult;
export function createComponentFactoryWithRenderer<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactoryResult<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
>(
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		FactoryResult
	>,
	options: ResolvedComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): FactoryResult;
export function createComponentFactoryWithRenderer<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactoryResult<
		State,
		Event,
		StatesResult,
		StandardCommandActor<State, Event>,
		CommandsResult,
		Additional,
		View,
		Events
	>,
>(
	createAdapter: UsesDefaultResolvers<
		State,
		Event,
		Snapshot,
		CommandActor
	> extends true
		? BaseAdapterFactory<State, Event, HTMLElement>
		: never,
	elementFactory: ComponentElementFactory<
		State,
		Event,
		StatesResult,
		StandardCommandActor<State, Event>,
		CommandsResult,
		Additional,
		View,
		Events,
		FactoryResult
	>,
	options?: DefaultComponentFactoryOptions<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		View,
		Events
	>,
): FactoryResult;
export function createComponentFactoryWithRenderer<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactoryResult<
		State,
		Event,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events
	>,
>(
	...invocation: RendererFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		View,
		Events,
		FactoryResult
	>
): unknown {
	if (isMetadataRendererFactoryInvocation(invocation)) {
		const componentInvocation: MetadataComponentFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events
		> = [invocation[0], invocation[2]];
		return createMetadataComponentFactory(componentInvocation, invocation[1]);
	}
	if (isExplicitRendererFactoryInvocation(invocation)) {
		const componentInvocation: ExplicitComponentFactoryInvocation<
			State,
			Event,
			Snapshot,
			StatesResult,
			CommandActor,
			CommandsResult,
			Additional,
			View,
			Events
		> = [invocation[0], invocation[2]];
		return createExplicitComponentFactory(componentInvocation, invocation[1]);
	}
	const componentInvocation: DefaultComponentFactoryInvocation<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		View,
		Events
	> = [invocation[0], invocation[2]];
	return createDefaultComponentFactory(componentInvocation, invocation[1]);
}

/**
 * @internal Low-level component factory used by `igniteCore`. Not part of the
 * public `ignite-element` surface — no package entry re-exports it. Use the
 * adapter `igniteCore` entrypoints instead.
 */
export function createComponentFactory<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: ResolvedAdapterFactory<
		State,
		Event,
		HTMLElement,
		Snapshot,
		CommandActor
	>,
	options?: ComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>,
): ComponentFactoryResult<
	State,
	Event,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	TemplateResult | IgniteJsxChild,
	Events
>;
export function createComponentFactory<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: BaseAdapterFactory<State, Event, HTMLElement>,
	options: ResolvedComponentFactoryOptions<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>,
): ComponentFactoryResult<
	State,
	Event,
	StatesResult,
	CommandActor,
	CommandsResult,
	Additional,
	TemplateResult | IgniteJsxChild,
	Events
>;
export function createComponentFactory<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: UsesDefaultResolvers<
		State,
		Event,
		Snapshot,
		CommandActor
	> extends true
		? BaseAdapterFactory<State, Event, HTMLElement>
		: never,
	options?: DefaultComponentFactoryOptions<
		State,
		Event,
		StatesResult,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>,
): ComponentFactoryResult<
	State,
	Event,
	StatesResult,
	StandardCommandActor<State, Event>,
	CommandsResult,
	Additional,
	TemplateResult | IgniteJsxChild,
	Events
>;
export function createComponentFactory<
	State,
	Event,
	Snapshot = State,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = StandardCommandActor<State, Event>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	...invocation: ComponentFactoryInvocation<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>
): unknown {
	if (isMetadataComponentFactoryInvocation(invocation)) {
		return createMetadataComponentFactory(invocation);
	}
	if (isExplicitComponentFactoryInvocation(invocation)) {
		return createExplicitComponentFactory(invocation);
	}
	return createDefaultComponentFactory(invocation);
}
