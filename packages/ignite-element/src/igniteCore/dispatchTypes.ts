import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import type { MobxConfig } from "./mobxTypes";
import type { ReduxBlueprintConfig, ReduxBlueprintSource } from "./reduxTypes";

// Only the internal generic dispatcher needs a discriminator to select a
// factory's adapter. Dedicated entrypoints already select their integration.
export type DispatchMobxConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Omit<
	MobxConfig<State, Events, StatesResult, CommandsResult>,
	"source" | "adapter"
> &
	(
		| { adapter: "mobx"; source: () => State }
		| {
				adapter?: "mobx";
				source: State extends (...args: unknown[]) => unknown ? never : State;
		  }
	);

export type DispatchReduxBlueprintConfig<
	Source extends ReduxBlueprintSource,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = ReduxBlueprintConfig<Source, Events, StatesResult, CommandsResult> &
	(Source extends (...args: unknown[]) => unknown
		? { adapter: "redux" }
		: { adapter?: "redux" });
