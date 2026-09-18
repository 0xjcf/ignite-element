/** Reject removed configuration before native source acquisition. */
export function assertSupportedSourceOptions(options?: object): void {
	if (options && "cleanup" in options) {
		throw new Error(
			"[igniteCore] Config `cleanup` was removed; independent elements release their runtime automatically, and shared cores retain observation until core.dispose().",
		);
	}
}
