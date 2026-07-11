import { igniteCore } from "ignite-element/xstate";
import { describe, expect, it } from "vitest";
import { formMachine } from "./formMachine";
import { type FormField, isValid } from "./validation";

// The same core the element registers, minus the renderer: keeping validation
// and the machine pure means the whole form drives through Ignite's headless
// runtime — `execute` issues a command, `getView` reads the projection — with no
// DOM and no rendered element.
const makeForm = () =>
	igniteCore({
		source: formMachine,
		view: ({ snapshot }) => ({
			values: snapshot.context.values,
			errors: snapshot.context.errors,
			status: snapshot.value as "editing" | "submitting" | "success",
			canSubmit: isValid(snapshot.context.values),
		}),
		commands: ({ actor }) => ({
			updateField: (payload: { field: FormField; value: string }) =>
				actor.send({ type: "SET_FIELD", ...payload }),
			blurField: (field: FormField) =>
				actor.send({ type: "BLUR_FIELD", field }),
			submit: () => actor.send({ type: "SUBMIT" }),
			reset: () => actor.send({ type: "RESET" }),
		}),
	});

const waitForStatus = async (
	form: ReturnType<typeof makeForm>,
	status: string,
) => {
	for (let i = 0; i < 100; i += 1) {
		if (form.getView().status === status) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error(`timed out waiting for status "${status}"`);
};

describe("signup form — headless runtime", () => {
	it("projects per-field validation through getView", async () => {
		const form = makeForm();
		await form.execute({
			command: "updateField",
			input: { field: "email", value: "nope" },
		});
		await form.execute({ command: "blurField", input: "email" });

		expect(form.getView().errors.email).toBe("Enter a valid email address");
		expect(form.getView().canSubmit).toBe(false);
	});

	it("blocks an invalid submit and stays editing", async () => {
		const form = makeForm();
		await form.execute({ command: "submit" });

		const view = form.getView();
		expect(view.status).toBe("editing");
		expect(view.errors).toEqual({
			name: "Name is required",
			email: "Email is required",
			password: "Password is required",
		});
	});

	it("submits a valid form through to success", async () => {
		const form = makeForm();
		await form.execute({
			command: "updateField",
			input: { field: "name", value: "Ada" },
		});
		await form.execute({
			command: "updateField",
			input: {
				field: "email",
				value: "ada@example.com",
			},
		});
		await form.execute({
			command: "updateField",
			input: { field: "password", value: "hunter2!" },
		});
		expect(form.getView().canSubmit).toBe(true);

		await form.execute({ command: "submit" });
		await waitForStatus(form, "success");
		expect(form.getView().status).toBe("success");
	});
});
