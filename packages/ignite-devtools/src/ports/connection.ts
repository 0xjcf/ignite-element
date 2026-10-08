export const DEVTOOLS_MESSAGE_VERSION = 1 as const;

export type DevtoolsSurface =
	| "web"
	| "pwa"
	| "cli"
	| "mcp"
	| "headless"
	| "workbench"
	| "replay"
	| "port";

export type DevtoolsMessageKind =
	| "hello"
	| "states"
	| "event"
	| "command"
	| "bye";

export type DevtoolsMessage = {
	v: typeof DEVTOOLS_MESSAGE_VERSION;
	seq: number;
	runtimeId: string;
	at: number;
	surface: DevtoolsSurface;
	kind: DevtoolsMessageKind;
	payload: unknown;
};

export type RuntimeConnection = {
	connect: (runtimeId: string) => void;
	messages: () => readonly DevtoolsMessage[];
	send: (message: DevtoolsMessage) => void;
};

export type AttachedRuntime = {
	id: string;
	label: string;
	getStates: () => unknown;
};

export type InMemoryConnection = RuntimeConnection & {
	attach: (runtime: AttachedRuntime) => void;
	attached: (runtimeId: string) => AttachedRuntime | undefined;
};

export function createInMemoryConnection(): InMemoryConnection {
	const runtimes = new Map<string, AttachedRuntime>();
	const log: DevtoolsMessage[] = [];
	return {
		attach(runtime) {
			runtimes.set(runtime.id, runtime);
		},
		attached: (runtimeId) => runtimes.get(runtimeId),
		connect(runtimeId) {
			if (!runtimes.has(runtimeId)) {
				throw new Error(`No attached runtime "${runtimeId}".`);
			}
		},
		messages: () => log.slice(),
		send(message) {
			log.push(structuredClone(message));
		},
	};
}
