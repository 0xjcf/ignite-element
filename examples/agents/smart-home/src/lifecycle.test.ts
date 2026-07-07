import { describe, expect, it, vi } from "vitest";
import { runSmartHomeBridgeCli } from "./lifecycle";

type ProcessSignal = "SIGINT" | "SIGTERM";
type ProcessListener = (...args: unknown[]) => void;

function captureProcessState() {
	const originalExitCode = process.exitCode;
	const originalListeners = new Map<ProcessSignal, Set<ProcessListener>>(
		(["SIGINT", "SIGTERM"] as const).map((signal) => [
			signal,
			new Set(process.listeners(signal) as ProcessListener[]),
		]),
	);

	return () => {
		for (const [signal, listeners] of originalListeners) {
			for (const listener of process.listeners(signal) as ProcessListener[]) {
				if (!listeners.has(listener)) {
					process.removeListener(signal, listener);
				}
			}
		}
		process.exitCode = originalExitCode;
	};
}

const flushTasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("smart-home bridge lifecycle", () => {
	it("reuses one close promise when signal shutdown races startup callback failure", async () => {
		const restoreProcess = captureProcessState();
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		let resolveClose!: () => void;
		const closePromise = new Promise<void>((resolve) => {
			resolveClose = resolve;
		});
		const server = {
			port: 5177,
			close: vi.fn(() => closePromise),
		};

		try {
			const runPromise = runSmartHomeBridgeCli({
				displayName: "Smart-home test bridge",
				start: async () => server,
				onStarted: () => {
					process.emit("SIGINT");
					throw new Error("startup callback failed");
				},
			});

			await flushTasks();
			await flushTasks();

			expect(server.close).toHaveBeenCalledTimes(1);

			resolveClose();
			await runPromise;
			await flushTasks();

			expect(server.close).toHaveBeenCalledTimes(1);
			expect(exitSpy).not.toHaveBeenCalled();
			expect(errorSpy).toHaveBeenCalledWith("\nstartup callback failed");
		} finally {
			restoreProcess();
			vi.restoreAllMocks();
		}
	});

	it("sets exitCode instead of forcing process exit on startup failures", async () => {
		const restoreProcess = captureProcessState();
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			await runSmartHomeBridgeCli({
				displayName: "Smart-home test bridge",
				start: async () => {
					throw new Error("startup failed");
				},
				onStarted: () => {},
			});

			expect(process.exitCode).toBe(1);
			expect(exitSpy).not.toHaveBeenCalled();
		} finally {
			restoreProcess();
			vi.restoreAllMocks();
		}
	});
});
