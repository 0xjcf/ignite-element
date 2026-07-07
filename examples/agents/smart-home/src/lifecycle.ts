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
					process.exit(1);
				}
			}
			if (!server) {
				console.error(
					`\n${options.displayName} was not available before ${signal}.`,
				);
				process.exit(1);
			}
			await waitForLifecyclePromise(
				server.close(),
				`closing ${options.displayName} after ${signal}`,
			);
			process.exit(0);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				`\nFailed to close ${options.displayName} after ${signal}: ${message}`,
			);
			process.exit(1);
		}
	};

	const handleSignal = (signal: string) => {
		if (shuttingDown) {
			console.error(`\nForcing exit on repeated ${signal}.`);
			process.exit(1);
		}
		void shutdown(signal);
	};

	process.on("SIGINT", () => handleSignal("SIGINT"));
	process.on("SIGTERM", () => handleSignal("SIGTERM"));

	try {
		startupPromise = options.start();
		server = await startupPromise;
		options.onStarted(server);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`\n${message}`);
		process.exit(1);
	}
}
