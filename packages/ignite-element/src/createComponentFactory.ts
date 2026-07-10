import type { IgniteAdapter, StateScope } from "@ignite-element/core";
import type {
	IgniteJsxChild,
	RenderStrategyFactory,
} from "@ignite-element/renderer";
import type { TemplateResult } from "lit-html";
import {
	type AdapterFactory,
	createProjectionFactory,
	type ProjectionFactory,
	type ProjectionFactoryOptions,
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
	createAdapter: AdapterFactory<State, Event, HTMLElement>,
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
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
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

/**
 * @internal Low-level component factory used by `igniteCore`. Not part of the
 * public `ignite-element` surface — no package entry re-exports it. Use the
 * adapter `igniteCore` entrypoints instead.
 */
export function createComponentFactoryWithRenderer<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	View = TemplateResult | IgniteJsxChild,
	Events extends EventMap = EmptyEventMap,
	FactoryResult = ComponentFactory<
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
	>,
>(
	createAdapter: AdapterFactory<State, Event, HTMLElement>,
	elementFactory: ElementFactoryCreator<
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
		FactoryResult,
		Events,
		StatesResult
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
): FactoryResult {
	const { createRenderStrategy, ...projectionOptions } = options ?? {};
	const projection = createProjectionFactory<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		Events,
		HTMLElement
	>(createAdapter, {
		...projectionOptions,
		debugName: "createComponentFactory",
	});

	return bindProjectionToElements<
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
		FactoryResult,
		Events,
		StatesResult
	>(projection, {
		elementFactory,
		createRenderStrategy,
		errorPrefix: "createComponentFactory",
	});
}

/**
 * @internal Low-level component factory used by `igniteCore`. Not part of the
 * public `ignite-element` surface — no package entry re-exports it. Use the
 * adapter `igniteCore` entrypoints instead.
 */
export function createComponentFactory<
	State,
	Event,
	Snapshot,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandActor = {
		send: (event: Event) => void;
		getState: () => State;
	},
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
	Additional extends Record<string, unknown> = Record<never, never>,
	Events extends EventMap = EmptyEventMap,
>(
	createAdapter: AdapterFactory<State, Event, HTMLElement>,
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
): ComponentFactory<
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
	>
> {
	return createComponentFactoryWithRenderer<
		State,
		Event,
		Snapshot,
		StatesResult,
		CommandActor,
		CommandsResult,
		Additional,
		TemplateResult | IgniteJsxChild,
		Events
	>(createAdapter, igniteElementFactory, options);
}
