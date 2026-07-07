export const SMART_HOME_LIFECYCLE_WAIT_TIMEOUT_MS = 10_000;
export const SMART_HOME_STARTUP_WAIT_TIMEOUT_MS = 30_000;

export async function waitForLifecyclePromise<T>(
	promise: Promise<T>,
	description: string,
	timeoutMs = SMART_HOME_LIFECYCLE_WAIT_TIMEOUT_MS,
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(new Error(`Timed out after ${timeoutMs}ms ${description}.`));
				}, timeoutMs);
			}),
		]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

type SmartHomeBridgeLifecycleServer = {
	port: number;
	close(): Promise<void>;
};

export async function runSmartHomeBridgeCli<
	TServer extends SmartHomeBridgeLifecycleServer,
>(options: {
	displayName: string;
	start(): Promise<TServer>;
	onStarted(server: TServer): void;
	startupTimeoutMs?: number;
}): Promise<void> {
	let server: TServer | undefined;
	let startupPromise: Promise<TServer> | undefined;
	let shuttingDown = false;
	let closePromise: Promise<void> | undefined;

	const closeServer = (description: string) => {
		if (!server) {
			return Promise.reject(
				new Error(`${options.displayName} is not available to close.`),
			);
		}
		closePromise ??= waitForLifecyclePromise(server.close(), description);
		return closePromise;
	};

	const markExit = (code: number) => {
		process.exitCode = code;
	};

	const shutdown = async (signal: string) => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		try {
			if (startupPromise) {
				try {
					server = await waitForLifecyclePromise(
						startupPromise,
						`waiting for ${options.displayName} startup before ${signal}`,
						options.startupTimeoutMs ?? SMART_HOME_STARTUP_WAIT_TIMEOUT_MS,
					);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error(
						`\n${options.displayName} failed to start before ${signal}: ${message}`,
					);
					markExit(1);
					return;
				}
			}
			if (!server) {
				console.error(
					`\n${options.displayName} was not available before ${signal}.`,
				);
				markExit(1);
				return;
			}
			await closeServer(`closing ${options.displayName} after ${signal}`);
			if (!process.exitCode) {
				markExit(0);
			}
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				`\nFailed to close ${options.displayName} after ${signal}: ${message}`,
			);
			markExit(1);
			return;
		}
	};

	const handleSignal = (signal: string) => {
		if (shuttingDown) {
			console.error(`\nExit already in progress after repeated ${signal}.`);
			markExit(1);
			return;
		}
		void shutdown(signal);
	};

	process.on("SIGINT", () => handleSignal("SIGINT"));
	process.on("SIGTERM", () => handleSignal("SIGTERM"));

	try {
		startupPromise = options.start();
		server = await startupPromise;
		try {
			options.onStarted(server);
		} catch (error) {
			await closeServer(
				`closing ${options.displayName} after startup callback failure`,
			).catch(() => undefined);
			throw error;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n${message}`);
		markExit(1);
	}
}
