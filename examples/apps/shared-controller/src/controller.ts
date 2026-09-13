/** Synthetic application contract. The external service, not this UI, accepts writes. */
export type Density = "comfortable" | "compact";
export type Session = Readonly<{ account: string; epoch: string }>;
export type ReadResult =
	| { kind: "value"; account: string; density: Density }
	| { kind: "unavailable" };
export type WriteRequest = Readonly<
	Session & { operation: number; density: Density }
>;
export type WriteResult =
	| ({ kind: "accepted" } & WriteRequest)
	| { kind: "rejected" | "unknown" };
export interface Ports {
	read(session: Session): Promise<ReadResult>;
	write(request: WriteRequest): Promise<WriteResult>;
	after(milliseconds: number, callback: () => void): () => void;
	report(error: unknown): void;
}
export type Snapshot = Readonly<{
	confirmed: Density | null;
	requested: Density | null;
	outcome: "idle" | "pending" | "confirmed" | "rejected" | "unknown";
	loading: boolean;
	readFailed: boolean;
}>;
export function isDensity(value: unknown): value is Density {
	return value === "comfortable" || value === "compact";
}

export function createController(session: Session, ports: Ports) {
	let state: Snapshot = Object.freeze({
		confirmed: null,
		requested: null,
		outcome: "idle",
		loading: false,
		readFailed: false,
	});
	let active = true;
	let revision = 0;
	let operation = 0;
	let cancelDeadline: (() => void) | undefined;
	const listeners = new Set<() => void>();
	const publish = (patch: Partial<Snapshot>) => {
		state = Object.freeze({ ...state, ...patch });
		for (const listener of [...listeners]) listener();
	};
	const canChoose = () =>
		active &&
		state.confirmed !== null &&
		state.outcome !== "pending" &&
		state.outcome !== "unknown";
	const current = (ticket: number) => active && ticket === revision;
	async function check(): Promise<void> {
		if (!active || state.loading) return;
		const ticket = revision;
		publish({ loading: true, readFailed: false });
		try {
			const result = await ports.read(session);
			if (!current(ticket)) return;
			if (
				result.kind === "value" &&
				result.account === session.account &&
				isDensity(result.density)
			) {
				// A query observes a value; it does not settle a write whose outcome is unknown.
				publish({ confirmed: result.density, readFailed: false });
			} else publish({ readFailed: true });
		} catch (error) {
			if (current(ticket)) {
				publish({ readFailed: true });
				ports.report(error);
			}
		} finally {
			if (current(ticket)) publish({ loading: false });
		}
	}
	async function choose(density: Density): Promise<void> {
		if (!isDensity(density) || !canChoose() || density === state.confirmed)
			return;
		const ticket = ++revision;
		const request: WriteRequest = Object.freeze({
			...session,
			operation: ++operation,
			density,
		});
		publish({
			requested: density,
			outcome: "pending",
			loading: false,
			readFailed: false,
		});
		try {
			cancelDeadline = ports.after(5000, () => {
				if (current(ticket)) publish({ outcome: "unknown" });
			});
			const result = await ports.write(request);
			if (!current(ticket)) return;
			if (
				result.kind === "accepted" &&
				result.account === request.account &&
				result.epoch === request.epoch &&
				result.operation === request.operation &&
				result.density === request.density
			) {
				publish({ confirmed: density, outcome: "confirmed" });
			} else
				publish({
					outcome: result.kind === "rejected" ? "rejected" : "unknown",
				});
		} catch (error) {
			if (current(ticket)) {
				publish({ outcome: "unknown" });
				ports.report(error);
			}
		} finally {
			if (current(ticket)) {
				++revision; // Also invalidates queries that started while the write was pending.
				const cancel = cancelDeadline;
				cancelDeadline = undefined;
				cancel?.();
				publish({ loading: false });
			}
		}
	}
	async function retry(): Promise<void> {
		if (active && state.outcome === "rejected" && state.requested !== null)
			await choose(state.requested);
	}
	return {
		snapshot: () => state,
		check,
		choose,
		retry,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		observerCount: () => listeners.size,
		dispose() {
			if (!active) return;
			active = false;
			++revision;
			listeners.clear();
			const cancel = cancelDeadline;
			cancelDeadline = undefined;
			cancel?.();
			// Invalidate observations and deadline only. There is no transport cancellation port.
		},
	};
}
export type Controller = ReturnType<typeof createController>;
