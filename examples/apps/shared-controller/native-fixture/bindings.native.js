import * as React from "react";
import { act, create } from "react-test-renderer";
import { createFakePorts } from "../dist/fake-ports.js";
import { NativeDensityView } from "../dist/native.js";
import { createOwner } from "../dist/owner.js";

test("native control handlers borrow the canonical controller and never equate fulfillment with success", async () => {
	expect(typeof document).toBe("undefined");
	expect(typeof HTMLElement).toBe("undefined");
	const fake = createFakePorts();
	const owner = createOwner({ account: "demo", epoch: "login-1" }, fake.ports);
	const tree = (second) =>
		React.createElement(
			React.StrictMode,
			null,
			React.createElement(NativeDensityView, { core: owner.core, key: "a" }),
			second &&
				React.createElement(NativeDensityView, { core: owner.core, key: "b" }),
		);
	let root;
	await act(() => {
		root = create(tree(true));
	});
	const press = (id) =>
		root.root.findAllByProps({ testID: id })[0].props.onPress();
	const statuses = () =>
		root.root
			.findAllByProps({ testID: "density-status" })
			.map((item) => item.props.children);
	await act(async () => {
		press("load");
		fake.reads[0].resolve({
			kind: "value",
			account: "demo",
			density: "comfortable",
		});
	});
	const retained = root.root.findAllByProps({ testID: "compact" })[0].props
		.onPress;
	await act(() => retained());
	expect(fake.writes).toHaveLength(1);
	expect(statuses().every((text) => text.includes("Saving"))).toBe(true);
	await act(() => retained());
	expect(fake.writes).toHaveLength(1);
	await act(async () => {
		fake.writes[0].result.resolve({ kind: "rejected" });
	});
	expect(statuses().every((text) => text.includes("rejected"))).toBe(true);
	await act(() => press("retry"));
	await act(() => fake.advance(5000));
	expect(statuses().every((text) => text.includes("unknown"))).toBe(true);
	await act(() => root.update(tree(false)));
	expect(owner.observationCount()).toBe(1);
	await act(async () => {
		const write = fake.writes[1];
		write.result.resolve({ kind: "accepted", ...write.request });
	});
	expect(
		statuses().every((text) => text.includes("Confirmed density: compact")),
	).toBe(true);
	await act(() => root.unmount());
	expect(owner.observationCount()).toBe(1);
	owner.dispose();
	expect(owner.observationCount()).toBe(0);
	expect(() => retained()).toThrow(/disposed/);
});
