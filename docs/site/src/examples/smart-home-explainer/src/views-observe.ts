import { home, restoreHome } from "./views-session";

export type NoticeOrigin = "headless" | "dom";

export type HomeNotice = {
	origin: NoticeOrigin;
	name: string;
	summary: string;
};

export type NoticeListener = (
	notices: readonly HomeNotice[],
	toast: HomeNotice | null,
) => void;

const PUBLIC_EVENTS = [
	"light-changed",
	"scene-applied",
	"security-changed",
] as const;

const listeners = new Set<NoticeListener>();
let notices: HomeNotice[] = [];
let toast: HomeNotice | null = null;
let restoring = false;

function publish(): void {
	for (const listener of listeners) {
		listener(notices, toast);
	}
}

function record(notice: HomeNotice): void {
	if (restoring) {
		return;
	}
	notices = [notice, ...notices].slice(0, 16);
	if (notice.origin === "headless") {
		toast = notice;
	}
	publish();
}

export function watchNotices(listener: NoticeListener): () => void {
	listeners.add(listener);
	listener(notices, toast);
	return () => {
		listeners.delete(listener);
	};
}

export function formatNotice(
	name: string,
	payload: Record<string, unknown>,
): string {
	if (name === "light-changed") {
		const room = String(payload.room ?? "room");
		return `${room} light ${payload.on ? "on" : "off"}`;
	}
	if (name === "scene-applied") {
		return `${String(payload.scene ?? "scene")} scene applied`;
	}
	if (name === "security-changed") {
		return payload.allDoorsLocked ? "all doors locked" : "a door unlocked";
	}
	return JSON.stringify(payload);
}

function recordHeadless(name: string, payload: Record<string, unknown>): void {
	record({
		origin: "headless",
		name,
		summary: formatNotice(name, payload),
	});
}

function onDom(name: string) {
	return (event: Event) => {
		const detail =
			event instanceof CustomEvent &&
			event.detail &&
			typeof event.detail === "object"
				? (event.detail as Record<string, unknown>)
				: {};
		record({
			origin: "dom",
			name,
			summary: formatNotice(name, detail),
		});
	};
}

/**
 * Subscribe before the user clicks. Headless `on` and DOM forwarding both
 * observe the same declared public names; events are not replayed.
 */
export function connectHomeObserver(element: EventTarget): () => void {
	const unsubscribes = [
		home.on("light-changed", (event: { room: string; on: boolean }) =>
			recordHeadless("light-changed", { room: event.room, on: event.on }),
		),
		home.on("scene-applied", (event: { scene: string }) =>
			recordHeadless("scene-applied", { scene: event.scene }),
		),
		home.on("security-changed", (event: { allDoorsLocked: boolean }) =>
			recordHeadless("security-changed", {
				allDoorsLocked: event.allDoorsLocked,
			}),
		),
	];
	const domHandlers = PUBLIC_EVENTS.map((name) => {
		const handler = onDom(name);
		element.addEventListener(name, handler);
		return () => element.removeEventListener(name, handler);
	});

	return () => {
		for (const handle of unsubscribes) {
			handle.unsubscribe();
		}
		for (const release of domHandlers) {
			release();
		}
	};
}

export async function resetHome(): Promise<void> {
	restoring = true;
	notices = [];
	toast = null;
	publish();
	try {
		await restoreHome();
		await Promise.resolve();
	} finally {
		restoring = false;
	}
}
