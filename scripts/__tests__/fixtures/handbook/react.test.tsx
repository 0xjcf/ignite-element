import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SharedCounters } from "./shared-counter";
import { core, source } from "./counter-core";

it("shares count and label through remounts without ending its borrowed source", () => {
	try {
		render(
			<StrictMode>
				<SharedCounters />
			</StrictMode>,
		);
		fireEvent.click(screen.getAllByRole("button", { name: "Increment" })[0]);
		expect(
			screen.getAllByLabelText("Count").map((node) => node.textContent),
		).toEqual(["1", "1"]);
		fireEvent.click(screen.getAllByRole("button", { name: "Decrement" })[1]);
		expect(
			screen.getAllByLabelText("Count").map((node) => node.textContent),
		).toEqual(["0", "0"]);
		fireEvent.change(screen.getAllByLabelText("Counter label")[0], {
			target: { value: "Guests" },
		});
		expect(screen.getAllByDisplayValue("Guests")).toHaveLength(2);
		cleanup();
		source.send({ type: "INCREMENT" });
		render(<SharedCounters />);
		expect(
			screen.getAllByLabelText("Count").map((node) => node.textContent),
		).toEqual(["1", "1"]);
	} finally {
		cleanup();
		try {
			core.dispose();
		} finally {
			source.stop();
		}
	}
});
