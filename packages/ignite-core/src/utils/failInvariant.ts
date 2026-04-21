export function failInvariant(message: string): never {
	throw new Error(message);
}
