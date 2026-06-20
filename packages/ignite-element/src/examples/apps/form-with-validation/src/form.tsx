import { igniteCore } from "ignite-element/xstate";
import formStyles from "./form.css?raw";
import { formMachine } from "./formMachine";
import { type FormField, isValid } from "./validation";

// The fields, declared as data so the view stays a simple map. Email uses a text
// input with an email inputmode rather than `type="email"` so the browser's
// native constraint validation never competes with the machine's own validation
// — this demo is about *our* validation flow.
const FIELDS: ReadonlyArray<{
	name: FormField;
	label: string;
	type: string;
	inputmode?: string;
	placeholder: string;
}> = [
	{ name: "name", label: "Name", type: "text", placeholder: "Ada Lovelace" },
	{
		name: "email",
		label: "Email",
		type: "text",
		inputmode: "email",
		placeholder: "ada@example.com",
	},
	{
		name: "password",
		label: "Password",
		type: "password",
		placeholder: "At least 8 characters",
	},
];

// The ignite element. View is a pure projection of the machine snapshot
// (`{ snapshot }` — the forward-compatible context shape, like spa-router);
// commands derive from the injected `actor` and use source-native `actor.send`.
const registerForm = igniteCore({
	source: formMachine,
	view: ({ snapshot }) => ({
		values: snapshot.context.values,
		errors: snapshot.context.errors,
		touched: snapshot.context.touched,
		submitError: snapshot.context.submitError,
		status: snapshot.value as "editing" | "submitting" | "success",
		canSubmit: isValid(snapshot.context.values),
	}),
	commands: ({ actor }) => ({
		// A single object payload (not two positional args) so the command is
		// driveable through the headless runtime's `execute(name, payload)`. Named
		// `updateField` rather than `setField` on purpose: a single-arg `setX`
		// command is inferred as a string-attribute, which makes no sense for a
		// multi-field form.
		updateField: (payload: { field: FormField; value: string }) =>
			actor.send({ type: "SET_FIELD", ...payload }),
		blurField: (field: FormField) => actor.send({ type: "BLUR_FIELD", field }),
		submit: () => actor.send({ type: "SUBMIT" }),
		reset: () => actor.send({ type: "RESET" }),
	}),
});

// Registering defines <signup-form>; index.html just uses the tag. The view is
// authored with ignite-JSX (the config-free default renderer; the transform is
// driven by this example's tsconfig `jsxImportSource`, like spa-router). Styles
// are injected into the Shadow DOM via a raw <style> — document CSS can't reach
// shadow content.
registerForm("signup-form", (ctx) => {
	if (ctx.status === "success") {
		return (
			<div class="card">
				<style>{formStyles}</style>
				<output class="success">
					<h1>You're all set 🎉</h1>
					<p>
						Welcome aboard, <strong>{ctx.values.name}</strong>.
					</p>
					<button type="button" class="btn" onClick={() => ctx.reset()}>
						Sign up another
					</button>
				</output>
			</div>
		);
	}

	const submitting = ctx.status === "submitting";

	return (
		<div class="card">
			<style>{formStyles}</style>
			<h1>Create your account</h1>
			<p class="lede">
				An ignite element: an XState machine + ignite-JSX view.
			</p>
			<form
				onSubmit={(event: Event) => {
					event.preventDefault();
					ctx.submit();
				}}
			>
				{FIELDS.map((field) => {
					const error = ctx.touched[field.name]
						? ctx.errors[field.name]
						: undefined;
					return (
						<label class="field" key={field.name}>
							<span class="field-label">{field.label}</span>
							<input
								class={error ? "input input-invalid" : "input"}
								type={field.type}
								inputmode={field.inputmode}
								value={ctx.values[field.name]}
								placeholder={field.placeholder}
								aria-invalid={error ? "true" : "false"}
								disabled={submitting}
								onInput={(event: Event) =>
									ctx.updateField({
										field: field.name,
										value: (event.currentTarget as HTMLInputElement).value,
									})
								}
								onBlur={() => ctx.blurField(field.name)}
							/>
							<span class="error">{error ?? ""}</span>
						</label>
					);
				})}

				{ctx.submitError ? (
					<p class="submit-error" role="alert">
						{ctx.submitError}
					</p>
				) : null}

				<button
					type="submit"
					class="btn btn-primary"
					disabled={!ctx.canSubmit || submitting}
				>
					{submitting ? "Creating account…" : "Sign up"}
				</button>
			</form>
		</div>
	);
});
