/** Per core, keyed by actual acquired adapter (isolated instances stay separate). */
export function createEventOrigins() {
	let owners = new WeakMap<object, Map<string, number>>();
	let ended = false;
	return {
		observe(owner: object, name: string, origin: "native" | "effect"): void {
			if (ended || !isDevelopment()) return;
			let names = owners.get(owner);
			if (!names) {
				names = new Map();
				owners.set(owner, names);
			}
			const previous = names.get(name) ?? 0;
			const next = previous | (origin === "native" ? 1 : 2);
			names.set(name, next);
			if (next === 3 && previous !== 3) {
				// Diagnostic infrastructure must never interrupt source execution.
				try {
					console.warn(
						`[igniteCore] Event "${name}" was observed from both native and effect producers. Keep one production rule per public event.`,
					);
				} catch {
					/* A user-installed console must not change delivery. */
				}
			}
		},
		dispose(): void {
			ended = true;
			owners = new WeakMap();
		},
	};
}

function isDevelopment(): boolean {
	// Keep the same NODE_ENV convention, with the expression the package's
	// production bundler replaces. Unbundled browsers have no process global.
	try {
		return process.env.NODE_ENV !== "production";
	} catch {
		return true;
	}
}
