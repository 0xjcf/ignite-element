import type { CommandContext, EffectContext } from "@ignite-element/core";
import {
	configureStore,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { makeAutoObservable } from "mobx";
import { expectTypeOf, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore as mobxCore } from "../../mobx";
import { useIgnite } from "../../react";
import { igniteCore as reduxCore } from "../../redux";
import { igniteCore as xstateCore } from "../../xstate";

it("exposes only the resolved source property in public command contexts", () => {
	expectTypeOf<
		keyof CommandContext<{ send(): void }>
	>().toEqualTypeOf<"source">();
	expectTypeOf<
		Extract<keyof EffectContext<unknown>, "source" | "actor">
	>().toEqualTypeOf<never>();
});

// Compile-only: invalid calls and hook invocation must never execute as a test.
function contracts() {
	const machine = createMachine({
		types: {} as { events: { type: "ADD"; amount: number } },
	});
	const core = xstateCore({
		source: machine,
		commands: ({ source: actor }) => ({
			add: (amount: number) => {
				actor.send({ type: "ADD", amount });
				// @ts-expect-error The actor still requires the source-native payload.
				actor.send({ type: "ADD", amount: "bad" });
				// @ts-expect-error No extra store methods are introduced.
				actor.dispatch({ type: "ADD" });
			},
		}),
	});
	const ctx = useIgnite(core);
	expectTypeOf(ctx.add).toEqualTypeOf<(amount: number) => void>();
	// @ts-expect-error Hook command arguments stay numeric.
	ctx.add("bad");
	core.execute({ command: "add", input: 1 });
	// @ts-expect-error Headless command arguments stay numeric.
	core.execute({ command: "add", input: "bad" });
	const commands = core.get("commands");
	// @ts-expect-error Catalogue command names remain inferred.
	commands.missing;
	xstateCore({
		source: machine,
		// @ts-expect-error actor is removed, rather than retained as an alias.
		commands: ({ actor }) => ({
			add: () => actor.send({ type: "ADD", amount: 1 }),
		}),
	});

	const slice = createSlice({
		name: "counter",
		initialState: { count: 0 },
		reducers: {
			add: (s, action: PayloadAction<number>) => {
				s.count += action.payload;
			},
		},
	});
	const source = configureStore({ reducer: slice.reducer });
	const redux = reduxCore({
		source,
		states: (snapshot) => ({ count: snapshot.count }),
		commands: ({ source: store }) => ({
			add: (amount: number) => store.dispatch(slice.actions.add(amount)),
		}),
	});
	expectTypeOf(useIgnite(redux).add).returns.toEqualTypeOf<void>();
	const mobx = mobxCore({
		source: makeAutoObservable({
			count: 0,
			add(amount: number) {
				this.count += amount;
				return this.count;
			},
		}),
		commands: ({ source: store }) => ({
			add: (amount: number) => store.add(amount),
		}),
	});
	expectTypeOf(useIgnite(mobx).add).toEqualTypeOf<(amount: number) => number>();
}
void contracts;
