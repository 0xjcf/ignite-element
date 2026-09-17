import { jsx } from "ignite-element/jsx/jsx-runtime";
import { expect, it } from "vitest";
import { core as reduxSlice } from "./redux-slice";
import { core as reduxFactory } from "./redux-factory";
import { core as mobxFactory } from "./mobx-factory";

const examples = [
	{
		name: "Redux slice",
		register: (tag: string) =>
			reduxSlice(tag, (ctx) =>
				jsx("button", { onClick: () => ctx.increment(), children: ctx.count }),
			),
		dispose: () => reduxSlice.dispose(),
	},
	{
		name: "Redux store factory",
		register: (tag: string) =>
			reduxFactory(tag, (ctx) =>
				jsx("button", { onClick: () => ctx.increment(), children: ctx.count }),
			),
		dispose: () => reduxFactory.dispose(),
	},
	{
		name: "MobX observable factory",
		register: (tag: string) =>
			mobxFactory(tag, (ctx) =>
				jsx("button", { onClick: () => ctx.increment(), children: ctx.count }),
			),
		dispose: () => mobxFactory.dispose(),
	},
];

for (const example of examples) {
	it(`${example.name}: the displayed module gives each element independent state`, async () => {
		const tag = `source-counter-${crypto.randomUUID()}`;
		const first = document.createElement(tag);
		const second = document.createElement(tag);
		try {
			example.register(tag);
			document.body.append(first, second);
			const firstButton = first.shadowRoot?.querySelector("button");
			const secondButton = second.shadowRoot?.querySelector("button");
			if (!firstButton || !secondButton) {
				throw new Error("Both example elements must render a button");
			}
			expect([firstButton.textContent, secondButton.textContent]).toEqual([
				"0",
				"0",
			]);
			firstButton.click();
			await Promise.resolve();
			expect([firstButton.textContent, secondButton.textContent]).toEqual([
				"1",
				"0",
			]);
			secondButton.click();
			secondButton.click();
			await Promise.resolve();
			expect([firstButton.textContent, secondButton.textContent]).toEqual([
				"1",
				"2",
			]);
		} finally {
			first.remove();
			second.remove();
			example.dispose();
		}
	});
}
