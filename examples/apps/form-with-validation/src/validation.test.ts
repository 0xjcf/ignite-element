import { describe, expect, it } from "vitest";
import { emptyValues, isValid, validateAll, validateField } from "./validation";

describe("form validation (pure core)", () => {
	it("requires a non-empty name", () => {
		expect(validateField("name", "")).toBe("Name is required");
		expect(validateField("name", "   ")).toBe("Name is required");
		expect(validateField("name", "Ada")).toBeNull();
	});

	it("validates email shape", () => {
		expect(validateField("email", "")).toBe("Email is required");
		expect(validateField("email", "nope")).toBe("Enter a valid email address");
		expect(validateField("email", "ada@example")).toBe(
			"Enter a valid email address",
		);
		expect(validateField("email", "ada@example.com")).toBeNull();
	});

	it("enforces a minimum password length", () => {
		expect(validateField("password", "")).toBe("Password is required");
		expect(validateField("password", "short")).toBe(
			"Password must be at least 8 characters",
		);
		expect(validateField("password", "longenough")).toBeNull();
	});

	it("collects all field errors with validateAll", () => {
		expect(validateAll(emptyValues)).toEqual({
			name: "Name is required",
			email: "Email is required",
			password: "Password is required",
		});
		expect(
			validateAll({
				name: "Ada",
				email: "ada@example.com",
				password: "hunter2!",
			}),
		).toEqual({});
	});

	it("isValid is true only when every field passes", () => {
		expect(isValid(emptyValues)).toBe(false);
		expect(
			isValid({ name: "Ada", email: "ada@example.com", password: "hunter2!" }),
		).toBe(true);
	});
});
