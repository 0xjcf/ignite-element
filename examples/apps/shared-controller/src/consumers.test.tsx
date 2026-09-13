import { useIgnite } from "ignite-element/react";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { Core } from "./owner.js";
import { DensityView } from "./react.js";
import { at, fixture } from "./test-fixture.js";
import { DensityElement } from "./web.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const turn = async () => {
	await Promise.resolve();
	await Promise.resolve();
};
function button(root: ParentNode, label: string): HTMLButtonElement {
	const found = [...root.querySelectorAll("button")].find(
		(item) => item.textContent === label,
	);
	if (!found) throw new Error(`Missing ${label} control`);
	return found;
}
it("actual custom-element handlers share pending work, unsubscribe and replace owners", async () => {
	customElements.define("shared-density-test", DensityElement);
	const f = fixture();
	const first = new DensityElement();
	const second = new DensityElement();
	first.owner = f.owner;
	second.owner = f.owner;
	document.body.append(first, second);
	button(first, "Load").click();
	at(f.fake.reads, 0).resolve({
		kind: "value",
		account: "demo",
		density: "comfortable",
	});
	await turn();
	const retained = button(first, "compact");
	retained.click();
	expect(f.fake.writes).toHaveLength(1);
	expect(first.textContent).toContain("Saving");
	expect(first.textContent).toBe(second.textContent);
	first.remove();
	retained.dispatchEvent(new MouseEvent("click"));
	expect(f.fake.writes).toHaveLength(1);
	f.fake.advance(5000);
	expect(second.textContent).toContain("unknown");
	expect(f.owner.observationCount()).toBe(1);
	const write = at(f.fake.writes, 0);
	write.result.resolve({ kind: "accepted", ...write.request });
	await turn();
	expect(second.textContent).toContain("Confirmed density: compact");
	const replacement = fixture("demo", "new-login");
	second.owner = replacement.owner;
	f.owner.dispose();
	expect(second.textContent).toContain("No confirmed preference");
	second.remove();
	replacement.owner.dispose();
});
it("React StrictMode borrows one prepared core with stable cached states/commands and real controls", async () => {
	const f = fixture();
	const replacement = fixture("demo", "new-login");
	function useModel(core: Core) {
		return useIgnite(core);
	}
	let captured: ReturnType<typeof useModel> | undefined;
	let renders = 0;
	function Probe({ core }: { core: Core }) {
		captured = useModel(core);
		renders++;
		return <DensityView core={core} />;
	}
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	const render = (second: Core | null) => (
		<StrictMode>
			<Probe core={f.owner.core} />
			{second && <DensityView core={second} />}
		</StrictMode>
	);
	await act(() => root.render(render(f.owner.core)));
	if (!captured) throw new Error("Hook did not render");
	const original = captured;
	const choose = original.choose;
	await act(() => root.render(render(f.owner.core)));
	expect(captured).toBe(original);
	expect(renders).toBeLessThan(20);
	await act(async () => {
		button(host, "Load").click();
		at(f.fake.reads, 0).resolve({
			kind: "value",
			account: "demo",
			density: "comfortable",
		});
	});
	expect(captured.choose).toBe(choose);
	await act(() => button(host, "compact").click());
	expect(host.textContent).toContain("Saving");
	await act(() => choose("comfortable"));
	expect(f.fake.writes).toHaveLength(1);
	await act(() => root.render(render(null)));
	expect(f.owner.observationCount()).toBe(1);
	await act(async () => {
		at(f.fake.writes, 0).result.resolve({ kind: "rejected" });
	});
	expect(host.textContent).toContain("rejected");
	expect(host.textContent).not.toContain("Confirmed density: compact");
	await act(() => button(host, "Retry").click());
	await act(async () => {
		const write = at(f.fake.writes, 1);
		write.result.resolve({ kind: "accepted", ...write.request });
	});
	expect(host.textContent).toContain("Confirmed density: compact");
	let direct: Promise<void> | undefined;
	await act(() => {
		direct = choose("comfortable");
	});
	await act(() => root.render(<Probe core={replacement.owner.core} />));
	expect(host.textContent).toContain("No confirmed preference");
	f.owner.dispose();
	expect(() => choose("compact")).toThrow(/disposed/);
	const write = at(f.fake.writes, 2);
	write.result.resolve({ kind: "accepted", ...write.request });
	expect(await direct).toBeUndefined();
	await act(() => root.unmount());
	expect(replacement.owner.observationCount()).toBe(1);
	replacement.owner.dispose();
	host.remove();
});
