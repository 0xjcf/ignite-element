import type { MobxEvent } from "@ignite-element/adapters/mobx";
import { createMobXAdapter } from "@ignite-element/adapters/mobx";
import type {
	EmptyEventMap,
	EventMap,
	FacadeCommandFunction,
	FacadeCommandResult,
} from "@ignite-element/core";
import { assertSupportedSourceOptions } from "../internal/assertSupportedSourceOptions";
import { createIgniteComponentFactory } from "./createIgniteComponentFactory";
import type { IgniteCoreReturn, MobxConfig } from "./mobxTypes";

// Keep inline makeAutoObservable(...) contextual inference on the instance path.
export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult> & {
		source: State extends (...args: unknown[]) => unknown ? never : State;
	},
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events
>;

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events
>;

export function igniteCoreMobx<
	State extends object,
	Events extends EventMap = EmptyEventMap,
	StatesResult extends Record<string, unknown> = Record<never, never>,
	CommandsResult extends FacadeCommandResult = Record<
		never,
		FacadeCommandFunction
	>,
>(
	options: MobxConfig<State, Events, StatesResult, CommandsResult>,
): IgniteCoreReturn<
	State,
	MobxEvent<State>,
	State,
	StatesResult,
	State,
	CommandsResult,
	Events
> {
	assertSupportedSourceOptions(options);
	const createAdapter = createMobXAdapter(options.source);
	return createIgniteComponentFactory<
		State,
		MobxEvent<State>,
		State,
		StatesResult,
		State,
		CommandsResult,
		Events
	>(createAdapter, options, createAdapter) as IgniteCoreReturn<
		State,
		MobxEvent<State>,
		State,
		StatesResult,
		State,
		CommandsResult,
		Events
	>;
}
