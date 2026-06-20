// Functional core: pure, deterministic validation. No I/O, no DOM, no clock —
// just values in, errors out. This is what makes the form headless-testable and
// keeps the XState machine's `assign`/guards pure.

export interface FormValues {
	name: string;
	email: string;
	password: string;
}

export type FormField = keyof FormValues;

export type FormErrors = Partial<Record<FormField, string>>;

export const PASSWORD_MIN_LENGTH = 8;

// Pragmatic email shape check — intentionally simple (one @, a dot in the
// domain). Real apps verify by sending mail, not by regex.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One validator per field. Each returns an error message or null.
const fieldValidators: Record<FormField, (value: string) => string | null> = {
	name: (value) => (value.trim().length === 0 ? "Name is required" : null),
	email: (value) => {
		if (value.trim().length === 0) return "Email is required";
		return EMAIL_PATTERN.test(value) ? null : "Enter a valid email address";
	},
	password: (value) => {
		if (value.length === 0) return "Password is required";
		return value.length < PASSWORD_MIN_LENGTH
			? `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
			: null;
	},
};

export const validateField = (field: FormField, value: string): string | null =>
	fieldValidators[field](value);

export const validateAll = (values: FormValues): FormErrors => {
	const errors: FormErrors = {};
	for (const field of Object.keys(values) as FormField[]) {
		const error = fieldValidators[field](values[field]);
		if (error) errors[field] = error;
	}
	return errors;
};

export const isValid = (values: FormValues): boolean =>
	Object.keys(validateAll(values)).length === 0;

export const emptyValues: FormValues = { name: "", email: "", password: "" };
