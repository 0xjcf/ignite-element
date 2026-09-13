import type {
	Ports,
	ReadResult,
	WriteRequest,
	WriteResult,
} from "./controller.js";
export function deferred<T>() {
	let resolve: (value: T) => void = () => {
		throw new Error("Promise not initialized");
	};
	let reject: (error: unknown) => void = () => {
		throw new Error("Promise not initialized");
	};
	const promise = new Promise<T>((accept, fail) => {
		resolve = accept;
		reject = fail;
	});
	return { promise, resolve, reject };
}
/** Deterministic transport and clock; never contacts a service or uses wall-clock waits. */
export function createFakePorts() {
	let now = 0;
	const deadlines = new Map<() => void, number>();
	const reads: ReturnType<typeof deferred<ReadResult>>[] = [];
	const writes: {
		request: WriteRequest;
		result: ReturnType<typeof deferred<WriteResult>>;
	}[] = [];
	const errors: unknown[] = [];
	const ports: Ports = {
		read() {
			const result = deferred<ReadResult>();
			reads.push(result);
			return result.promise;
		},
		write(request) {
			const result = deferred<WriteResult>();
			writes.push({ request, result });
			return result.promise;
		},
		after(delay, callback) {
			deadlines.set(callback, now + delay);
			return () => {
				deadlines.delete(callback);
			};
		},
		report(error) {
			errors.push(error);
		},
	};
	return {
		ports,
		reads,
		writes,
		errors,
		advance(milliseconds: number) {
			now += milliseconds;
			for (const [callback, at] of [...deadlines])
				if (at <= now) {
					deadlines.delete(callback);
					callback();
				}
		},
	};
}
