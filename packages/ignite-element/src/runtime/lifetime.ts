export function disposedError(): Error {
	return new Error(
		"[igniteCore] Core is disposed; live acquisition and delivery have ended.",
	);
}

/** Release all records, preserving even a nullish first thrown value. */
export function releaseAll(releases: Iterable<() => void>): void {
	let failed = false;
	let failure: unknown;
	for (const release of releases) {
		try {
			release();
		} catch (error) {
			if (!failed) {
				failed = true;
				failure = error;
			}
		}
	}
	if (failed) throw failure;
}

export function createLifetime() {
	let ended = false;
	const records = new Set<() => void>();
	const assertActive = () => {
		if (ended) throw disposedError();
	};
	return {
		get active() {
			return !ended;
		},
		assertActive,
		own(cleanup: () => void): () => void {
			let active = true;
			const release = () => {
				if (!active) return;
				active = false;
				records.delete(release);
				cleanup();
			};
			if (ended) {
				try {
					release();
				} catch (error) {
					console.error(
						"[igniteCore] Late acquisition rollback failed.",
						error,
					);
				}
				throw disposedError();
			}
			records.add(release);
			return release;
		},
		dispose(nativeRelease?: () => void): void {
			if (ended) return;
			ended = true;
			const owned = [...records];
			records.clear();
			if (nativeRelease) owned.push(nativeRelease);
			releaseAll(owned);
		},
	};
}

export type Lifetime = ReturnType<typeof createLifetime>;
