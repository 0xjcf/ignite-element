export const SMART_HOME_LIFECYCLE_WAIT_TIMEOUT_MS = 10_000;

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
