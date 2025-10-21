import type { EnhancedStore, Slice } from "@reduxjs/toolkit";

// Infer RootState from Slice or Store
export type InferRootState<Source extends Slice | EnhancedStore> =
	Source extends Slice
		? { [K in Source["name"]]: ReturnType<Source["reducer"]> }
		: Source extends EnhancedStore
			? ReturnType<Source["getState"]>
			: never;

type InferEventFromCreators<Creators> = Creators extends Record<
	string,
	infer Creator
>
	? Creator extends (...args: infer _Args) => infer Event
		? Event extends { type: string }
			? Event
			: never
		: never
	: never;

type NormalizeEvent<Event> = Event extends { type: infer Type }
	? Event extends { payload: infer Payload }
		? undefined extends Payload
			? Event | { type: Type; payload?: Exclude<Payload, undefined> }
			: Event | { type: Type; payload: Payload }
		: Event | { type: Type }
	: Event;

// Infer Events from Action Creators
export type InferEvent<Actions> = NormalizeEvent<
	InferEventFromCreators<Actions>
>;

type InferStoreState<Source> = Source extends () => EnhancedStore
	? ReturnType<ReturnType<Source>["getState"]>
	: Source extends EnhancedStore
		? ReturnType<Source["getState"]>
		: never;

// Infer events for stores from their dispatch signature
type StoreActionCreators<Source> = Source extends { __igniteActions: infer A }
	? A
	: undefined;

type StoreDispatchEvent<Source extends (() => EnhancedStore) | EnhancedStore> =
	Source extends () => EnhancedStore
		? StoreActionCreators<ReturnType<Source>> extends undefined
			? Parameters<ReturnType<Source>["dispatch"]>[0]
			: InferEvent<StoreActionCreators<ReturnType<Source>>>
		: Source extends EnhancedStore
			? StoreActionCreators<Source> extends undefined
				? Parameters<Source["dispatch"]>[0]
				: InferEvent<StoreActionCreators<Source>>
			: never;

export type InferStateAndEvent<
	Source extends Slice | (() => EnhancedStore) | EnhancedStore,
> = Source extends Slice
	? {
			State: InferRootState<Source>;
			Event: InferEvent<Source["actions"]>;
		}
	: Source extends (() => EnhancedStore) | EnhancedStore
		? {
				State: InferStoreState<Source>;
				Event: StoreDispatchEvent<Source>;
			}
		: never;
