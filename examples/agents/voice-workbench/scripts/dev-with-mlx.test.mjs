import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_MLX_LM_VERSION,
	DEFAULT_MODEL,
	LauncherError,
	probeModelServer,
	resolveLauncherConfig,
	runLauncher,
} from "./dev-with-mlx.mjs";

class FakeChild extends EventEmitter {
	constructor(label) {
		super();
		this.exitCode = null;
		this.killSignals = [];
		this.label = label;
		this.pid = FakeChild.nextPid++;
		this.signalCode = null;
	}

	finish(code = 0, signal = null) {
		if (this.exitCode !== null || this.signalCode !== null) return;
		this.exitCode = code;
		this.signalCode = signal;
		this.emit("exit", code, signal);
	}

	kill(signal) {
		this.killSignals.push(signal);
		queueMicrotask(() => this.finish(null, signal));
		return true;
	}

	static nextPid = 1_000;
}

function readyResponse(models = [DEFAULT_MODEL]) {
	return {
		json: async () => ({ data: models.map((id) => ({ id })) }),
		ok: true,
		status: 200,
	};
}

function incompatibleResponse(status = 404) {
	return {
		json: async () => ({ error: "not found" }),
		ok: false,
		status,
	};
}

function createHarness({
	fetchSteps = [readyResponse()],
	onSpawn,
	pathExists = true,
	sleep,
} = {}) {
	const children = [];
	const exitCodes = [];
	const logs = [];
	const signals = new Map();
	const spawns = [];
	let fetchIndex = 0;

	const dependencies = {
		access: vi.fn(async () => {
			if (!pathExists) throw new Error("missing");
		}),
		fetch: vi.fn(async () => {
			const step =
				fetchSteps[Math.min(fetchIndex, fetchSteps.length - 1)] ??
				readyResponse();
			fetchIndex += 1;
			if (step instanceof Error) throw step;
			return step;
		}),
		killChild: vi.fn((child, signal) => {
			if (child.exitCode !== null || child.signalCode !== null) return;
			child.kill(signal);
		}),
		log: vi.fn((message) => logs.push(message)),
		mkdir: vi.fn(async () => {}),
		now: vi.fn(() => 0),
		offSignal: vi.fn((signal, handler) => {
			if (signals.get(signal) === handler) signals.delete(signal);
		}),
		onSignal: vi.fn((signal, handler) => signals.set(signal, handler)),
		setExitCode: vi.fn((code) => exitCodes.push(code)),
		sleep: sleep ?? vi.fn(async () => {}),
		spawn: vi.fn((command, args, options) => {
			const label = args.includes("mlx_lm.server")
				? "mlx"
				: command === "pnpm"
					? "web"
					: args.includes("venv")
						? "venv"
						: args[0] === "-c"
							? "version"
							: "install";
			const child = new FakeChild(label);
			children.push(child);
			spawns.push({ args, child, command, label, options });
			const handled = onSpawn?.({ args, child, command, label, options });
			if (!handled && ["venv", "version", "install", "web"].includes(label)) {
				queueMicrotask(() => child.finish(0));
			}
			return child;
		}),
	};

	return { children, dependencies, exitCodes, logs, signals, spawns };
}

function managedOptions(dependencies, env = {}) {
	return {
		dependencies,
		env: {
			VOICE_WORKBENCH_CACHE_DIR: "/tmp/voice-workbench-test",
			VOICE_WORKBENCH_MLX_POLL_INTERVAL_MS: "1",
			VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS: "100",
			VOICE_WORKBENCH_NO_OPEN: "1",
			...env,
		},
		system: {
			arch: "arm64",
			homeDirectory: "/tmp/home",
			platform: "darwin",
		},
	};
}

describe("voice workbench MLX launcher", () => {
	it("resolves a documented default and validates overrides", () => {
		const defaults = resolveLauncherConfig(
			{},
			{ arch: "arm64", homeDirectory: "/Users/test", platform: "darwin" },
		);
		expect(defaults).toMatchObject({
			baseUrl: "http://127.0.0.1:8080/v1",
			mlxLmVersion: DEFAULT_MLX_LM_VERSION,
			model: DEFAULT_MODEL,
			openBrowser: true,
			python: "python3",
		});

		const overridden = resolveLauncherConfig(
			{
				VITE_MLX_BASE_URL: "https://models.example.test/v1/",
				VOICE_WORKBENCH_MLX_MODEL: "local/model",
				VOICE_WORKBENCH_NO_OPEN: "true",
				VOICE_WORKBENCH_PYTHON: "/opt/python3.12",
				VOICE_WORKBENCH_WEB_PORT: "5199",
			},
			{ arch: "x64", homeDirectory: "/home/test", platform: "linux" },
		);
		expect(overridden).toMatchObject({
			baseUrl: "https://models.example.test/v1",
			externalEndpoint: true,
			model: "local/model",
			openBrowser: false,
			python: "/opt/python3.12",
			webPort: 5199,
		});

		expect(() =>
			resolveLauncherConfig(
				{ VOICE_WORKBENCH_MLX_PORT: "70000" },
				{
					arch: "arm64",
					homeDirectory: "/Users/test",
					platform: "darwin",
				},
			),
		).toThrow("VOICE_WORKBENCH_MLX_PORT must be at most 65535");
	});

	it("classifies ready, incompatible, and unreachable endpoints", async () => {
		const config = resolveLauncherConfig(
			{},
			{ arch: "arm64", homeDirectory: "/Users/test", platform: "darwin" },
		);
		await expect(
			probeModelServer(config, async () => readyResponse()),
		).resolves.toEqual({ status: "ready" });
		await expect(
			probeModelServer(config, async () => incompatibleResponse(401)),
		).resolves.toEqual({ detail: "HTTP 401", status: "incompatible" });
		await expect(
			probeModelServer(config, async () => {
				throw new Error("connection refused");
			}),
		).resolves.toEqual({
			detail: "connection refused",
			status: "unreachable",
		});
	});

	it("bootstraps the isolated environment before MLX and gates Vite on readiness", async () => {
		const fetchSteps = [
			new Error("not running"),
			new Error("model loading"),
			readyResponse(),
		];
		let versionChecks = 0;
		const harness = createHarness({
			fetchSteps,
			onSpawn: ({ child, label }) => {
				if (label === "version") {
					versionChecks += 1;
					queueMicrotask(() => child.finish(1));
					return true;
				}
				return false;
			},
			pathExists: false,
		});

		await runLauncher(managedOptions(harness.dependencies));

		expect(harness.spawns.map(({ label }) => label)).toEqual([
			"venv",
			"version",
			"install",
			"mlx",
			"web",
		]);
		expect(versionChecks).toBe(1);
		const web = harness.spawns.find(({ label }) => label === "web");
		expect(web.options.env).toMatchObject({
			VITE_MLX_BASE_URL: "http://127.0.0.1:8080/v1",
			VITE_MLX_MODEL: DEFAULT_MODEL,
		});
		expect(harness.dependencies.fetch).toHaveBeenCalledTimes(3);
		expect(
			harness.spawns.find(({ label }) => label === "mlx").child.killSignals,
		).toContain("SIGTERM");
	});

	it("reuses a compatible endpoint without touching Python or killing it", async () => {
		const harness = createHarness();
		await runLauncher({
			dependencies: harness.dependencies,
			env: {
				VITE_MLX_BASE_URL: "http://models.example.test/v1",
				VOICE_WORKBENCH_NO_OPEN: "1",
			},
			system: {
				arch: "x64",
				homeDirectory: "/home/test",
				platform: "linux",
			},
		});

		expect(harness.spawns.map(({ label }) => label)).toEqual(["web"]);
		expect(harness.dependencies.access).not.toHaveBeenCalled();
		expect(harness.spawns[0].child.killSignals).toEqual([]);
	});

	it("fails clearly on unsupported managed hardware and incompatible ports", async () => {
		const unavailable = createHarness({
			fetchSteps: [new Error("not running")],
		});
		await expect(
			runLauncher({
				dependencies: unavailable.dependencies,
				env: { VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS: "1" },
				system: {
					arch: "x64",
					homeDirectory: "/home/test",
					platform: "linux",
				},
			}),
		).rejects.toThrow("requires macOS on Apple Silicon");

		const occupied = createHarness({ fetchSteps: [incompatibleResponse()] });
		await expect(
			runLauncher(managedOptions(occupied.dependencies)),
		).rejects.toThrow("Port 8080 is occupied");
		expect(occupied.spawns).toHaveLength(0);
	});

	it("times out without starting Vite and stops the owned MLX process", async () => {
		const harness = createHarness({
			fetchSteps: [new Error("not running")],
		});
		harness.dependencies.now.mockReturnValueOnce(0).mockReturnValueOnce(2);

		await expect(
			runLauncher(
				managedOptions(harness.dependencies, {
					VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS: "1",
				}),
			),
		).rejects.toThrow("did not become ready within 1ms");
		expect(harness.spawns.some(({ label }) => label === "web")).toBe(false);
		expect(
			harness.spawns.find(({ label }) => label === "mlx").child.killSignals,
		).toContain("SIGTERM");
	});

	it("reports a model process that exits before readiness", async () => {
		const harness = createHarness({
			fetchSteps: [new Error("not running")],
			onSpawn: ({ child, label }) => {
				if (label === "mlx") {
					queueMicrotask(() => child.finish(2));
					return true;
				}
				return false;
			},
			sleep: vi.fn(() => new Promise(() => {})),
		});

		await expect(
			runLauncher(managedOptions(harness.dependencies)),
		).rejects.toThrow("MLX server stopped before becoming ready: exit code 2");
		expect(harness.spawns.some(({ label }) => label === "web")).toBe(false);
	});

	it("forwards SIGINT to launcher-owned children", async () => {
		let resolveWebSpawned;
		const webSpawned = new Promise((resolveSpawned) => {
			resolveWebSpawned = resolveSpawned;
		});
		const harness = createHarness({
			fetchSteps: [new Error("not running"), readyResponse()],
			onSpawn: ({ child, label }) => {
				if (label === "web") {
					resolveWebSpawned(child);
					return true;
				}
				return false;
			},
		});
		const running = runLauncher(managedOptions(harness.dependencies));
		await webSpawned;

		harness.signals.get("SIGINT")();
		await running;

		expect(harness.exitCodes).toEqual([0]);
		expect(
			harness.spawns.find(({ label }) => label === "mlx").child.killSignals,
		).toContain("SIGINT");
		expect(
			harness.spawns.find(({ label }) => label === "web").child.killSignals,
		).toContain("SIGINT");
		expect(harness.signals.size).toBe(0);
	});

	it("awaits an in-flight shutdown before the launcher returns", async () => {
		let resolveWebSpawned;
		const webSpawned = new Promise((resolveSpawned) => {
			resolveWebSpawned = resolveSpawned;
		});
		const harness = createHarness({
			fetchSteps: [new Error("not running"), readyResponse()],
			onSpawn: ({ child, label }) => {
				if (label === "web") {
					resolveWebSpawned(child);
					return true;
				}
				return false;
			},
		});
		const running = runLauncher(managedOptions(harness.dependencies));
		const web = await webSpawned;
		const mlx = harness.spawns.find(({ label }) => label === "mlx").child;
		harness.dependencies.killChild.mockImplementation((child, signal) => {
			child.killSignals.push(signal);
		});
		harness.dependencies.sleep.mockImplementation(() => new Promise(() => {}));
		let resolved = false;
		void running.then(() => {
			resolved = true;
		});

		harness.signals.get("SIGTERM")();
		web.finish(null, "SIGTERM");
		await Promise.resolve();
		await Promise.resolve();
		expect(resolved).toBe(false);

		mlx.finish(null, "SIGTERM");
		await running;
		expect(resolved).toBe(true);
	});

	it("does not spawn children when shutdown begins during the first probe", async () => {
		let rejectProbe;
		const firstProbe = new Promise((_resolve, reject) => {
			rejectProbe = reject;
		});
		const harness = createHarness({ fetchSteps: [firstProbe] });
		const running = runLauncher(managedOptions(harness.dependencies));

		harness.signals.get("SIGINT")();
		rejectProbe(new Error("probe cancelled"));
		await running;

		expect(harness.spawns).toHaveLength(0);
		expect(harness.exitCodes).toEqual([0]);
		expect(harness.signals.size).toBe(0);
	});

	it("uses typed launcher errors for invalid configuration", () => {
		expect(() =>
			resolveLauncherConfig(
				{ VITE_MLX_BASE_URL: "file:///tmp/model" },
				{
					arch: "arm64",
					homeDirectory: "/Users/test",
					platform: "darwin",
				},
			),
		).toThrow(LauncherError);
	});
});
