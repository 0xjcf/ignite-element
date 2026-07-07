import { describe, expect, it, vi } from "vitest";
import { runSmartHomeBridgeCli } from "./lifecycle";

type ProcessSignal = "SIGINT" | "SIGTERM";
type ProcessListener = ReturnType<typeof process.listeners>[number];

const trackedProcessSignals: ProcessSignal[] = ["SIGINT", "SIGTERM"];

function processListeners(signal: ProcessSignal): ProcessListener[] {
	return process.listeners(signal);
}

function mockProcessExit() {
	return vi.spyOn(process, "exit").mockImplementation((code) => {
		throw new Error(`Unexpected process.exit(${String(code)})`);
	});
}

function captureProcessState() {
	const originalExitCode = process.exitCode;
	const originalListeners = new Map<ProcessSignal, Set<ProcessListener>>(
		trackedProcessSignals.map((signal) => [
			signal,
			new Set(processListeners(signal)),
		]),
	);

	return () => {
		for (const [signal, listeners] of originalListeners) {
			for (const listener of processListeners(signal)) {
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
		const exitSpy = mockProcessExit();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		let resolveClose: (() => void) | undefined;
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

			if (!resolveClose) {
				throw new Error("Close promise resolver was not initialized.");
			}
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
		const exitSpy = mockProcessExit();
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

	it("logs cleanup failures after startup callback failures", async () => {
		const restoreProcess = captureProcessState();
		const exitSpy = mockProcessExit();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const server = {
			port: 5177,
			close: vi.fn(async () => {
				throw new Error("close failed");
			}),
		};

		try {
			await runSmartHomeBridgeCli({
				displayName: "Smart-home test bridge",
				start: async () => server,
				onStarted: () => {
					throw new Error("startup callback failed");
				},
			});

			expect(server.close).toHaveBeenCalledTimes(1);
			expect(errorSpy).toHaveBeenCalledWith(
				"\nFailed to close Smart-home test bridge after startup callback failure: close failed",
			);
			expect(errorSpy).toHaveBeenCalledWith("\nstartup callback failed");
			expect(process.exitCode).toBe(1);
			expect(exitSpy).not.toHaveBeenCalled();
		} finally {
			restoreProcess();
			vi.restoreAllMocks();
		}
	});

	it("times out startup instead of awaiting forever", async () => {
		vi.useFakeTimers();
		const restoreProcess = captureProcessState();
		const exitSpy = mockProcessExit();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		try {
			const runPromise = runSmartHomeBridgeCli({
				displayName: "Smart-home test bridge",
				start: async () => new Promise<never>(() => {}),
				onStarted: () => {},
				startupTimeoutMs: 25,
			});

			await vi.advanceTimersByTimeAsync(25);
			await runPromise;

			expect(errorSpy).toHaveBeenCalledWith(
				"\nTimed out after 25ms starting Smart-home test bridge.",
			);
			expect(process.exitCode).toBe(1);
			expect(exitSpy).not.toHaveBeenCalled();
		} finally {
			restoreProcess();
			vi.useRealTimers();
			vi.restoreAllMocks();
		}
	});
});
