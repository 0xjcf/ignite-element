export function failInvariant(value: unknown): never {
	if (typeof value === "string") {
		throw new Error(value);
	}
	throw value;
}
