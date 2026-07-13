import { spawn as nodeSpawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access as nodeAccess, mkdir as nodeMkdir } from "node:fs/promises";
import { homedir as nodeHomedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_MLX_LM_VERSION = "0.31.3";
export const DEFAULT_MODEL = "mlx-community/Mistral-7B-Instruct-v0.3-4bit";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_MLX_PORT = 8080;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_STARTUP_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_SHUTDOWN_GRACE_MS = 5_000;

export class LauncherError extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = "LauncherError";
	}
}

function trimmed(value) {
	return typeof value === "string" ? value.trim() : "";
}

function parseInteger(value, fallback, label, { maximum } = {}) {
	const candidate = trimmed(value);
	if (!candidate) return fallback;
	const parsed = Number(candidate);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new LauncherError(`${label} must be a positive integer.`);
	}
	if (maximum !== undefined && parsed > maximum) {
		throw new LauncherError(`${label} must be at most ${maximum}.`);
	}
	return parsed;
}

function parseFlag(value) {
	return ["1", "true", "yes"].includes(trimmed(value).toLowerCase());
}

function normalizeBaseUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new LauncherError(
			"VITE_MLX_BASE_URL must be an absolute http:// or https:// URL.",
		);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new LauncherError(
			"VITE_MLX_BASE_URL must use the http:// or https:// protocol.",
		);
	}
	url.pathname = url.pathname.replace(/\/+$/, "");
	url.search = "";
	url.hash = "";
	return url.toString().replace(/\/$/, "");
}

function defaultCacheDirectory(platform, homeDirectory, xdgCacheHome) {
	if (trimmed(xdgCacheHome)) {
		return join(xdgCacheHome, "ignite-element", "voice-workbench");
	}
	if (platform === "darwin") {
		return join(
			homeDirectory,
			"Library",
			"Caches",
			"ignite-element",
			"voice-workbench",
		);
	}
	return join(homeDirectory, ".cache", "ignite-element", "voice-workbench");
}

export function resolveLauncherConfig(
	env = process.env,
	system = {
		platform: process.platform,
		arch: process.arch,
		homeDirectory: nodeHomedir(),
	},
) {
	const model =
		trimmed(env.VOICE_WORKBENCH_MLX_MODEL) ||
		trimmed(env.VITE_MLX_MODEL) ||
		DEFAULT_MODEL;
	const mlxLmVersion =
		trimmed(env.VOICE_WORKBENCH_MLX_LM_VERSION) || DEFAULT_MLX_LM_VERSION;
	if (!/^[0-9A-Za-z.+_-]+$/.test(mlxLmVersion)) {
		throw new LauncherError(
			"VOICE_WORKBENCH_MLX_LM_VERSION contains unsupported characters.",
		);
	}

	const mlxPort = parseInteger(
		env.VOICE_WORKBENCH_MLX_PORT,
		DEFAULT_MLX_PORT,
		"VOICE_WORKBENCH_MLX_PORT",
		{ maximum: 65_535 },
	);
	const configuredBaseUrl = trimmed(env.VITE_MLX_BASE_URL);
	const baseUrl = normalizeBaseUrl(
		configuredBaseUrl || `http://${DEFAULT_HOST}:${mlxPort}/v1`,
	);
	const cacheDirectory = resolve(
		trimmed(env.VOICE_WORKBENCH_CACHE_DIR) ||
			defaultCacheDirectory(
				system.platform,
				system.homeDirectory,
				env.XDG_CACHE_HOME,
			),
	);
	const environmentDirectory = join(cacheDirectory, `mlx-lm-${mlxLmVersion}`);

	return {
		apiKey: trimmed(env.VITE_MLX_API_KEY),
		arch: system.arch,
		baseUrl,
		cacheDirectory,
		environmentDirectory,
		externalEndpoint: Boolean(configuredBaseUrl),
		mlxHost: DEFAULT_HOST,
		mlxLmVersion,
		mlxPort,
		model,
		openBrowser: !parseFlag(env.VOICE_WORKBENCH_NO_OPEN),
		platform: system.platform,
		pollIntervalMs: parseInteger(
			env.VOICE_WORKBENCH_MLX_POLL_INTERVAL_MS,
			DEFAULT_POLL_INTERVAL_MS,
			"VOICE_WORKBENCH_MLX_POLL_INTERVAL_MS",
		),
		python: trimmed(env.VOICE_WORKBENCH_PYTHON) || "python3",
		shutdownGraceMs: parseInteger(
			env.VOICE_WORKBENCH_SHUTDOWN_GRACE_MS,
			DEFAULT_SHUTDOWN_GRACE_MS,
			"VOICE_WORKBENCH_SHUTDOWN_GRACE_MS",
		),
		startupTimeoutMs: parseInteger(
			env.VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS,
			DEFAULT_STARTUP_TIMEOUT_MS,
			"VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS",
		),
		webHost: DEFAULT_HOST,
		webPort: trimmed(env.VOICE_WORKBENCH_WEB_PORT)
			? parseInteger(
					env.VOICE_WORKBENCH_WEB_PORT,
					undefined,
					"VOICE_WORKBENCH_WEB_PORT",
					{ maximum: 65_535 },
				)
			: undefined,
	};
}

function createExitPromise(child, label) {
	return new Promise((resolveExit) => {
		let settled = false;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			resolveExit({ label, ...result });
		};
		child.once("error", (error) => finish({ code: null, error, signal: null }));
		child.once("exit", (code, signal) => finish({ code, error: null, signal }));
	});
}

function describeExit(result) {
	if (result.error) return result.error.message;
	if (result.signal) return `signal ${result.signal}`;
	return `exit code ${result.code ?? "unknown"}`;
}

function realKillChild(child, signal) {
	if (child.exitCode !== null || child.signalCode !== null) return;
	if (process.platform !== "win32" && child.pid) {
		try {
			process.kill(-child.pid, signal);
			return;
		} catch (error) {
			if (error && typeof error === "object" && error.code === "ESRCH") return;
		}
	}
	child.kill(signal);
}

function runtimeDependencies(overrides = {}) {
	return {
		access: nodeAccess,
		fetch: globalThis.fetch,
		killChild: realKillChild,
		log: console.log,
		mkdir: nodeMkdir,
		now: Date.now,
		offSignal: (signal, handler) => process.off(signal, handler),
		onSignal: (signal, handler) => process.on(signal, handler),
		setExitCode: (code) => {
			process.exitCode = code;
		},
		sleep: (milliseconds) =>
			new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
		spawn: nodeSpawn,
		...overrides,
	};
}

function createLifecycle(deps, config) {
	const abortController = new AbortController();
	const owned = new Map();
	let stopping = false;

	function spawnOwned(label, command, args, options = {}) {
		let child;
		try {
			child = deps.spawn(command, args, {
				detached: process.platform !== "win32",
				stdio: "inherit",
				...options,
			});
		} catch (error) {
			throw new LauncherError(`Could not start ${label}: ${error.message}`, {
				cause: error,
			});
		}
		const exit = createExitPromise(child, label);
		owned.set(child, exit);
		return { child, exit, label };
	}

	async function run(label, command, args, options = {}) {
		const { allowFailure = false, ...spawnOptions } = options;
		const processHandle = spawnOwned(label, command, args, spawnOptions);
		const result = await processHandle.exit;
		owned.delete(processHandle.child);
		if (!allowFailure && (result.error || result.code !== 0)) {
			throw new LauncherError(`${label} failed with ${describeExit(result)}.`);
		}
		return result;
	}

	async function stop(signal = "SIGTERM") {
		if (stopping) return;
		stopping = true;
		abortController.abort();
		const active = [...owned.entries()];
		await Promise.all(
			active.map(async ([child, exit]) => {
				deps.killChild(child, signal);
				const result = await Promise.race([
					exit.then(() => "exited"),
					deps.sleep(config.shutdownGraceMs).then(() => "timed-out"),
				]);
				if (result === "timed-out") {
					deps.killChild(child, "SIGKILL");
				}
			}),
		);
	}

	return {
		abortController,
		get stopping() {
			return stopping;
		},
		run,
		spawnOwned,
		stop,
	};
}

async function pathExists(path, deps) {
	try {
		await deps.access(path, fsConstants.X_OK);
		return true;
	} catch {
		return false;
	}
}

async function ensureMlxEnvironment(config, lifecycle, deps) {
	if (config.platform !== "darwin" || config.arch !== "arm64") {
		throw new LauncherError(
			"The managed MLX launcher requires macOS on Apple Silicon. Set VITE_MLX_BASE_URL to reuse an external OpenAI-compatible endpoint on other systems.",
		);
	}

	await deps.mkdir(config.cacheDirectory, { recursive: true });
	const python = join(config.environmentDirectory, "bin", "python");
	if (!(await pathExists(python, deps))) {
		deps.log(
			`[voice-workbench] Creating isolated Python environment in ${config.environmentDirectory}`,
		);
		await lifecycle.run("Python environment bootstrap", config.python, [
			"-m",
			"venv",
			config.environmentDirectory,
		]);
	}

	const versionCheck = await lifecycle.run(
		"mlx-lm version check",
		python,
		[
			"-c",
			`import importlib.metadata as m,sys; sys.exit(0 if m.version("mlx-lm") == ${JSON.stringify(config.mlxLmVersion)} else 1)`,
		],
		{ allowFailure: true, stdio: "ignore" },
	);
	if (versionCheck.code !== 0) {
		deps.log(
			`[voice-workbench] Installing mlx-lm ${config.mlxLmVersion} into the isolated environment...`,
		);
		await lifecycle.run("mlx-lm installation", python, [
			"-m",
			"pip",
			"install",
			"--disable-pip-version-check",
			"--upgrade",
			`mlx-lm==${config.mlxLmVersion}`,
		]);
	}
	return python;
}

export async function probeModelServer(config, fetchImpl = globalThis.fetch) {
	const headers = { accept: "application/json" };
	if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
	try {
		const response = await fetchImpl(`${config.baseUrl}/models`, {
			headers,
			signal: AbortSignal.timeout(2_000),
		});
		if (!response.ok) {
			return { detail: `HTTP ${response.status}`, status: "incompatible" };
		}
		const body = await response.json();
		if (!body || !Array.isArray(body.data)) {
			return {
				detail: "the /models response did not contain a data array",
				status: "incompatible",
			};
		}
		return { status: "ready" };
	} catch (error) {
		return {
			detail: error instanceof Error ? error.message : String(error),
			status: "unreachable",
		};
	}
}

async function waitForModelServer(config, lifecycle, deps, mlxProcess) {
	const deadline = deps.now() + config.startupTimeoutMs;
	while (!lifecycle.abortController.signal.aborted) {
		const probe = await probeModelServer(config, deps.fetch);
		if (probe.status === "ready") return;
		if (probe.status === "incompatible") {
			throw new LauncherError(
				`The endpoint at ${config.baseUrl} is not an MLX/OpenAI-compatible server: ${probe.detail}.`,
			);
		}
		if (deps.now() >= deadline) {
			throw new LauncherError(
				`The MLX server did not become ready within ${config.startupTimeoutMs}ms. The first model download is about 4.08 GB; increase VOICE_WORKBENCH_MLX_STARTUP_TIMEOUT_MS if it is still progressing.`,
			);
		}

		const next = mlxProcess
			? await Promise.race([
					deps.sleep(config.pollIntervalMs).then(() => ({ type: "poll" })),
					mlxProcess.exit.then((result) => ({ result, type: "exit" })),
				])
			: await deps.sleep(config.pollIntervalMs).then(() => ({ type: "poll" }));
		if (next.type === "exit") {
			throw new LauncherError(
				`The MLX server stopped before becoming ready: ${describeExit(next.result)}.`,
			);
		}
	}
	throw new LauncherError("Voice workbench startup was cancelled.");
}

function mlxServerArgs(config) {
	return [
		"-m",
		"mlx_lm.server",
		"--model",
		config.model,
		"--host",
		config.mlxHost,
		"--port",
		String(config.mlxPort),
	];
}

function viteArgs(config) {
	const args = ["exec", "vite", "--host", config.webHost];
	if (config.webPort !== undefined) {
		args.push("--port", String(config.webPort), "--strictPort");
	}
	if (config.openBrowser) args.push("--open");
	return args;
}

export async function runLauncher(options = {}) {
	const deps = runtimeDependencies(options.dependencies);
	const config = resolveLauncherConfig(options.env, options.system);
	const lifecycle = createLifecycle(deps, config);
	const exampleDirectory = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"..",
	);
	let mlxProcess;
	const signalHandlers = new Map();

	for (const signal of ["SIGINT", "SIGTERM"]) {
		const handler = () => {
			deps.setExitCode(0);
			void lifecycle.stop(signal);
		};
		signalHandlers.set(signal, handler);
		deps.onSignal(signal, handler);
	}

	try {
		const initialProbe = await probeModelServer(config, deps.fetch);
		if (config.externalEndpoint) {
			if (initialProbe.status !== "ready") {
				deps.log(
					`[voice-workbench] Waiting for configured model endpoint ${config.baseUrl}...`,
				);
				await waitForModelServer(config, lifecycle, deps);
			}
			deps.log(
				`[voice-workbench] Reusing configured model endpoint ${config.baseUrl}.`,
			);
		} else if (initialProbe.status === "ready") {
			deps.log(
				`[voice-workbench] Reusing the MLX server already running at ${config.baseUrl}.`,
			);
		} else {
			if (initialProbe.status === "incompatible") {
				throw new LauncherError(
					`Port ${config.mlxPort} is occupied by an incompatible HTTP service (${initialProbe.detail}). Set VOICE_WORKBENCH_MLX_PORT to an available port.`,
				);
			}
			const python = await ensureMlxEnvironment(config, lifecycle, deps);
			deps.log(
				`[voice-workbench] Starting mlx-lm ${config.mlxLmVersion} with ${config.model}.`,
			);
			mlxProcess = lifecycle.spawnOwned(
				"MLX server",
				python,
				mlxServerArgs(config),
				{ cwd: exampleDirectory },
			);
			deps.log(
				"[voice-workbench] Waiting for the model endpoint. The first run downloads about 4.08 GB...",
			);
			await waitForModelServer(config, lifecycle, deps, mlxProcess);
		}

		if (lifecycle.stopping) return;
		deps.log(`[voice-workbench] Model endpoint ready at ${config.baseUrl}.`);
		const webProcess = lifecycle.spawnOwned(
			"Vite web server",
			"pnpm",
			viteArgs(config),
			{
				cwd: exampleDirectory,
				env: {
					...process.env,
					...options.env,
					VITE_MLX_BASE_URL: config.baseUrl,
					VITE_MLX_MODEL: config.model,
				},
			},
		);

		const exits = [
			webProcess.exit.then((result) => ({ owner: "web", result })),
		];
		if (mlxProcess) {
			exits.push(mlxProcess.exit.then((result) => ({ owner: "mlx", result })));
		}
		const firstExit = await Promise.race(exits);
		if (lifecycle.stopping) return;
		if (firstExit.owner === "web" && firstExit.result.code === 0) return;
		throw new LauncherError(
			`${firstExit.result.label} stopped unexpectedly: ${describeExit(firstExit.result)}.`,
		);
	} catch (error) {
		if (lifecycle.stopping) return;
		throw error;
	} finally {
		for (const [signal, handler] of signalHandlers) {
			deps.offSignal(signal, handler);
		}
		await lifecycle.stop();
	}
}

export async function main() {
	try {
		await runLauncher();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[voice-workbench] ${message}`);
		process.exitCode = 1;
	}
}

const isMain =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) await main();
