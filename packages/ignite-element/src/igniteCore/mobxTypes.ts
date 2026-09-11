import type { MobxConfig as StoreMobxConfig } from "@ignite-element/adapters/mobx";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";

export type { IgniteCoreReturn } from "./publicTypes";

import type { DisjointBindings } from "./publicTypes";

export type { MobxEvent } from "@ignite-element/adapters/mobx";
export type MobxConfig<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
> = Omit<
	StoreMobxConfig<State, Events, StatesResult, CommandsResult, unknown>,
	"adapter" | "source"
> &
	(
		| {
				adapter: "mobx";
				source: () => State;
		  }
		| {
				adapter?: "mobx";
				source: State extends (...args: unknown[]) => unknown ? never : State;
		  }
	) &
	DisjointBindings<NoInfer<StatesResult>, NoInfer<CommandsResult>>;
