import * as React from "react";
import type { IgniteComponent } from "../igniteCore/types";
import type {
	EventMap,
	EventPayload,
	FacadeCommandResult,
} from "../RenderArgs";

/**
 * `ignite-element/react` — schema-driven typed React wrapper.
 *
 * `igniteReact(component)` turns an {@link IgniteComponent} handle into an
 * idiomatic, fully typed React component. This is host-app coordination (React
 * glue at the shell boundary): it uses refs, effects, and DOM
 * `addEventListener` and reaches only the public handle (`tagName` +
 * `getSchema()`) and the element's own methods/attributes. It never touches the
 * functional core or adapters.
 *
 * Inference (compile-time) flows from the handle's phantom `Commands`/`Events`
 * generics; the wiring (runtime) reads `getSchema()`. Two surfaces, one source
 * each.
 */

// --- Type-level mapping --------------------------------------------------

/**
 * The imperative ref API: every command exposed as an element method, surfaced
 * directly. `Commands` is already a record of functions (FacadeCommandResult).
 */
export type CommandHandle<Commands extends FacadeCommandResult> = {
	[K in keyof Commands]: Commands[K];
};

/**
 * The imperative ref type for a component built by {@link igniteReact} — the
 * {@link CommandHandle} derived from the handle's command schema. Lets a
 * consumer type a `useRef` without hand-writing the command shape (and without
 * drift from the element's commands):
 *
 * ```ts
 * const ref = useRef<IgniteReactRef<typeof CounterCore>>(null);
 * ```
 */
export type IgniteReactRef<Component> = Component extends IgniteComponent<
	infer Commands,
	infer _Events
>
	? CommandHandle<Commands>
	: never;

/** Uppercase the first character of a string literal (lib `Capitalize`). */
type EventHandlerName<Type extends string> = `on${Capitalize<Type>}`;

/**
 * Events map -> `on<Event>` callback props. Each handler receives the custom
 * element's DOM `event.detail` directly — never the `{ type, payload }`
 * envelope.
 */
export type IgniteReactEventProps<Events extends EventMap> = {
	[K in keyof Events & string as EventHandlerName<K>]?: (
		event: EventPayload<Events[K]>,
	) => void;
};

/**
 * Lowercase the first character of a string literal (de-capitalize), the
 * inverse of the `set` + PascalCase observed-attribute convention.
 */
type Uncapitalize_<S extends string> = S extends `${infer First}${infer Rest}`
	? `${Lowercase<First>}${Rest}`
	: S;

/** Strip a leading `set` and de-capitalize: `setLabel` -> `label`. */
type DePrefixSet<K extends string> = K extends `set${infer Rest}`
	? Uncapitalize_<Rest>
	: never;

/**
 * Single-arg `setX` commands -> optional string props. Mirrors
 * `inferObservedAttributes`: only commands named `set*` (PascalCase tail) with
 * exactly one parameter map to an attribute. The prop is the de-prefixed,
 * de-capitalized command name and is set as a string attribute.
 */
export type IgniteReactSetterProps<Commands extends FacadeCommandResult> = {
	[K in keyof Commands & string as K extends `set${string}`
		? Parameters<Commands[K]> extends [unknown]
			? DePrefixSet<K>
			: never
		: never]?: string;
};

/**
 * The full public prop surface for an `igniteReact` component: `on<Event>`
 * callbacks + de-prefixed `setX` string props.
 */
export type IgniteReactProps<
	Commands extends FacadeCommandResult,
	Events extends EventMap,
> = IgniteReactEventProps<Events> & IgniteReactSetterProps<Commands>;

// --- Runtime wiring (shell coordination) ---------------------------------

const toHandlerName = (type: string): string =>
	`on${type.charAt(0).toUpperCase()}${type.slice(1)}`;

const toSetterAttr = (commandName: string): string | undefined => {
	if (
		commandName.length > 3 &&
		commandName.startsWith("set") &&
		commandName[3] === commandName[3].toUpperCase()
	) {
		return commandName[3].toLowerCase() + commandName.slice(4);
	}
	return undefined;
};

type ElementWithCommands = HTMLElement &
	Record<string, ((...args: unknown[]) => unknown) | undefined>;

/**
 * Wrap an {@link IgniteComponent} handle as a typed `forwardRef` React
 * component. No `tagName` argument and no manual type arguments — everything is
 * inferred from `component`.
 */
export function igniteReact<
	Commands extends FacadeCommandResult,
	Events extends EventMap,
>(
	component: IgniteComponent<Commands, Events>,
): React.ForwardRefExoticComponent<
	IgniteReactProps<Commands, Events> &
		React.RefAttributes<CommandHandle<Commands>>
> {
	const { tagName } = component;

	type Props = IgniteReactProps<Commands, Events>;

	const IgniteReactComponent = React.forwardRef<CommandHandle<Commands>, Props>(
		(props, ref) => {
			const elRef = React.useRef<HTMLElement | null>(null);
			const propsRef = React.useRef(props);
			propsRef.current = props;

			// Wire event listeners from the schema's event descriptors. Handlers
			// forward `event.detail` directly. Re-reads the latest callback through
			// propsRef so listeners stay stable across renders.
			// `component` is the closed-over handle and is stable for the wrapper's
			// lifetime, so the empty deps array is intentional — re-wiring on every
			// render would tear down and re-add listeners needlessly.
			// biome-ignore lint/correctness/useExhaustiveDependencies: component handle is stable; wire once on mount.
			React.useEffect(() => {
				const el = elRef.current;
				if (!el) return;
				const eventTypes = component
					.getSchema()
					.events.map((event) => event.type);
				const offs = eventTypes.map((type) => {
					const handlerName = toHandlerName(type);
					const listener = (event: Event) => {
						const cb = (
							propsRef.current as Record<
								string,
								((detail: unknown) => void) | undefined
							>
						)[handlerName];
						cb?.((event as CustomEvent).detail);
					};
					el.addEventListener(type, listener);
					return () => el.removeEventListener(type, listener);
				});
				return () => {
					for (const off of offs) off();
				};
			}, []);

			// Bind the command methods exposed on the element as the ref API.
			// `component` is stable for the wrapper's lifetime (see above).
			// biome-ignore lint/correctness/useExhaustiveDependencies: component handle is stable; bind once.
			React.useImperativeHandle(ref, () => {
				const el = elRef.current as ElementWithCommands | null;
				const commandNames = Object.keys(component.getSchema().commands);
				const handle = {} as Record<string, (...args: unknown[]) => unknown>;
				for (const name of commandNames) {
					handle[name] = (...args: unknown[]) => el?.[name]?.(...args);
				}
				return handle as CommandHandle<Commands>;
			}, []);

			// Map de-prefixed setX props back to the element's string attributes
			// (mirrors inferObservedAttributes on the element side).
			const attrs: Record<string, string> = {};
			const commandNames = Object.keys(component.getSchema().commands);
			for (const name of commandNames) {
				const attr = toSetterAttr(name);
				if (!attr) continue;
				const value = (props as Record<string, unknown>)[attr];
				if (typeof value === "string") {
					attrs[attr] = value;
				}
			}

			return React.createElement(tagName, { ref: elRef, ...attrs });
		},
	);

	IgniteReactComponent.displayName = `IgniteReact(${tagName})`;
	// forwardRef yields ForwardRefExoticComponent<PropsWithoutRef<Props> & …>;
	// Props has no `ref` key so PropsWithoutRef<Props> ≡ Props, but the alias
	// expansion is not structurally identical to TS, so assert the declared shape.
	return IgniteReactComponent as React.ForwardRefExoticComponent<
		IgniteReactProps<Commands, Events> &
			React.RefAttributes<CommandHandle<Commands>>
	>;
}
