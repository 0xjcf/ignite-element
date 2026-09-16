import type {
	EventMap,
	EventMemberFields,
	EventDescriptor,
} from "@ignite-element/core";

/** Erased/broad emissions provide no statically reservable names. */
export type KnownEmitted<Emitted> = 0 extends 1 & Emitted
	? never
	: Emitted extends { type: string }
		? string extends Emitted["type"]
			? never
			: Emitted
		: never;
export type NativeNames<Emitted> = KnownEmitted<Emitted> extends infer Known
	? Known extends { type: infer Name extends string }
		? Name
		: never
	: never;
export type EffectEvents<Events extends EventMap, Emitted> = [
	NativeNames<Emitted>,
] extends [never]
	? Events
	: {
			[Name in keyof Events as Name extends NativeNames<Emitted>
				? never
				: Name]: Events[Name];
		};
/** Only a present, typed native channel establishes an Actor-Web producer. */
export type ChannelEmitted<Source> = Source extends (
	...args: never[]
) => infer Result
	? ChannelEmitted<Result>
	: Source extends {
				subscribeEvent: (
					listener: (event: infer Emitted) => void,
					...args: never[]
				) => unknown;
			}
		? KnownEmitted<Emitted>
		: never;
type Payload<Member> = Member extends { type: string }
	? Omit<Member, "type">
	: never;
type DeclaredPayload<Descriptor extends EventDescriptor<unknown>> =
	EventMemberFields<Descriptor> extends infer Fields
		? [Fields] extends [never]
			? Record<never, never>
			: Fields extends object
				? Omit<Fields, "type">
				: Fields
		: never;
/** Select by membership, not Extract: one member may name several events. */
export type NativeMember<Member, Name extends string> = Member extends {
	type: infer Names extends string;
}
	? Name extends Names
		? Omit<Member, "type"> & { type: Name }
		: never
	: never;
/** A public declaration must accept every payload emitted under that name. */
export type CompatibleEvents<Events extends EventMap, Emitted> = {
	[Name in keyof Events]: Name extends string
		? [Payload<NativeMember<KnownEmitted<Emitted>, Name>>] extends [
				DeclaredPayload<Events[Name]>,
			]
			? Events[Name]
			: never
		: Events[Name];
};
