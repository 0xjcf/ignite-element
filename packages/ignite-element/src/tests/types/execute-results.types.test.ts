import { expectTypeOf, it } from "vitest";
import { createMachine } from "xstate";
import { igniteCore } from "../../xstate";

it("infers each serialized command value while preserving direct tuples and receivers", () => {
	const core = igniteCore({
		source: createMachine({}),
		commands: () => ({
			noop() {},
			required(input: { id: string }) {
				return input.id;
			},
			optional(input?: number) {
				return input ?? 0;
			},
			async dto(input: string[]) {
				return { id: input.join(":") };
			},
			tuple(left: number, right: number) {
				return left + right;
			},
		}),
	});
	const check = async () => {
		expectTypeOf(await core.execute({ command: "noop" })).toEqualTypeOf<void>();
		expectTypeOf(
			await core.execute({ command: "required", input: { id: "one" } }),
		).toEqualTypeOf<string>();
		expectTypeOf(
			await core.execute({ command: "optional" }),
		).toEqualTypeOf<number>();
		expectTypeOf(
			await core.execute({ command: "optional", input: 2 }),
		).toEqualTypeOf<number>();
		const dto = await core.execute({ command: "dto", input: ["one", "two"] });
		expectTypeOf(dto).toEqualTypeOf<{ id: string }>();
		// @ts-expect-error native receipts were removed
		dto.snapshot;
		// @ts-expect-error state reads are explicit
		dto.states;
		// @ts-expect-error events use subscriptions
		dto.events;
		// @ts-expect-error required input cannot be omitted
		core.execute({ command: "required" });
		// @ts-expect-error arrays are one input, not argument spreading
		core.execute({ command: "dto", input: "one" });
		// @ts-expect-error multiple required positional arguments cannot be serialized
		core.execute({ command: "tuple", input: [1, 2] });
	};
	void check;
	core("execute-result-type-check", (args) => {
		expectTypeOf(args.tuple).toEqualTypeOf<
			(left: number, right: number) => number
		>();
		return null;
	});
	core.dispose();
});
