import { describe, expect, it } from "vitest";
import { createActor, waitFor } from "xstate";
import { formMachine, TAKEN_EMAIL } from "./formMachine";

const start = () => createActor(formMachine).start();

const fillValid = (actor: ReturnType<typeof start>) => {
	actor.send({ type: "SET_FIELD", field: "name", value: "Ada" });
	actor.send({ type: "SET_FIELD", field: "email", value: "ada@example.com" });
	actor.send({ type: "SET_FIELD", field: "password", value: "hunter2!" });
};

describe("signup form machine", () => {
	it("starts editing with empty values", () => {
		const actor = start();
		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("editing");
		expect(snapshot.context.values).toEqual({
			name: "",
			email: "",
			password: "",
		});
		actor.stop();
	});

	it("sets a field value without flagging an untouched field", () => {
		const actor = start();
		actor.send({ type: "SET_FIELD", field: "name", value: "Ada" });
		const snapshot = actor.getSnapshot();
		expect(snapshot.context.values.name).toBe("Ada");
		expect(snapshot.context.errors.name).toBeUndefined();
		actor.stop();
	});

	it("validates on blur, then clears the error once corrected", () => {
		const actor = start();
		actor.send({ type: "BLUR_FIELD", field: "email" });
		expect(actor.getSnapshot().context.errors.email).toBe("Email is required");
		expect(actor.getSnapshot().context.touched.email).toBe(true);

		actor.send({ type: "SET_FIELD", field: "email", value: "ada@example.com" });
		expect(actor.getSnapshot().context.errors.email).toBeUndefined();
		actor.stop();
	});

	it("blocks an invalid submit and reveals every error", () => {
		const actor = start();
		actor.send({ type: "SUBMIT" });
		const snapshot = actor.getSnapshot();
		expect(snapshot.value).toBe("editing");
		expect(Object.keys(snapshot.context.errors)).toEqual([
			"name",
			"email",
			"password",
		]);
		expect(snapshot.context.touched).toEqual({
			name: true,
			email: true,
			password: true,
		});
		actor.stop();
	});

	it("submits a valid form through to success", async () => {
		const actor = start();
		fillValid(actor);
		actor.send({ type: "SUBMIT" });
		expect(actor.getSnapshot().value).toBe("submitting");

		await waitFor(actor, (snapshot) => snapshot.value === "success", {
			timeout: 2000,
		});
		expect(actor.getSnapshot().value).toBe("success");
		actor.stop();
	});

	it("returns to editing with a submitError when the server rejects", async () => {
		const actor = start();
		actor.send({ type: "SET_FIELD", field: "name", value: "Ada" });
		actor.send({ type: "SET_FIELD", field: "email", value: TAKEN_EMAIL });
		actor.send({ type: "SET_FIELD", field: "password", value: "hunter2!" });
		actor.send({ type: "SUBMIT" });
		expect(actor.getSnapshot().value).toBe("submitting");

		await waitFor(
			actor,
			(snapshot) =>
				snapshot.value === "editing" && snapshot.context.submitError !== null,
			{ timeout: 2000 },
		);
		expect(actor.getSnapshot().context.submitError).toBe(
			"That email is already registered",
		);
		actor.stop();
	});

	it("resets back to the initial context", () => {
		const actor = start();
		fillValid(actor);
		actor.send({ type: "RESET" });
		expect(actor.getSnapshot().context.values).toEqual({
			name: "",
			email: "",
			password: "",
		});
		actor.stop();
	});
});
