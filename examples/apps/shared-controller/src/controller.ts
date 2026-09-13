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
	const deadlines = new Set<() => void>();
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
		// Observers may dispose or start a write during synchronous delivery.
		if (!current(ticket)) return;
		let settled: Partial<Snapshot>;
		try {
			const result = await ports.read(session);
			if (!current(ticket)) return;
			if (
				result.kind === "value" &&
				result.account === session.account &&
				isDensity(result.density)
			) {
				// A query observes a value; it does not settle a write whose outcome is unknown.
				settled = { confirmed: result.density, readFailed: false };
			} else settled = { readFailed: true };
		} catch (error) {
			if (!current(ticket)) return;
			settled = { readFailed: true };
			ports.report(error);
		}
		// Publish the settled read once; no old finalizer may clear a reentrant read.
		if (current(ticket)) publish({ ...settled, loading: false });
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
		if (!current(ticket)) return;
		let cancelDeadline: (() => void) | undefined;
		const release = () => {
			const cancel = cancelDeadline;
			cancelDeadline = undefined;
			deadlines.delete(release);
			cancel?.();
		};
		let settled: Partial<Snapshot> = { outcome: "unknown" };
		try {
			deadlines.add(release);
			cancelDeadline = ports.after(5000, () => {
				if (current(ticket)) publish({ outcome: "unknown" });
			});
			// A port can also deliver synchronously before returning its handle.
			if (!current(ticket)) return;
			const result = await ports.write(request);
			if (!current(ticket)) return;
			if (
				result.kind === "accepted" &&
				result.account === request.account &&
				result.epoch === request.epoch &&
				result.operation === request.operation &&
				result.density === request.density
			) {
				settled = { confirmed: density, outcome: "confirmed" };
			} else
				settled = {
					outcome: result.kind === "rejected" ? "rejected" : "unknown",
				};
		} catch (error) {
			if (!current(ticket)) return;
			ports.report(error);
		} finally {
			// Release this operation's resource even after losing publication authority.
			release();
		}
		if (!current(ticket)) return;
		// Invalidate earlier queries before exposing a state that permits fresh work.
		++revision;
		publish({ ...settled, loading: false });
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
			for (const release of [...deadlines]) release();
			// Invalidate observations and deadline only. There is no transport cancellation port.
		},
	};
}
export type Controller = ReturnType<typeof createController>;
