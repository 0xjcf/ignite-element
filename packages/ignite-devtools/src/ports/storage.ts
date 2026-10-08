/** In-memory stand-in for `localStorage` keys under `ignite.devtools.*`. */
export const DEVTOOLS_STORAGE_PREFIX = "ignite.devtools.";

export const DEVTOOLS_CONNECTION_STORAGE_KEY = `${DEVTOOLS_STORAGE_PREFIX}connection`;

export type DevtoolsStorage = {
	get: (key: string) => string | undefined;
	set: (key: string, value: string) => void;
};

export type InMemoryStorage = DevtoolsStorage & {
	snapshot: () => Record<string, string>;
};

export function createInMemoryStorage(): InMemoryStorage {
	const records = new Map<string, string>();
	return {
		get: (key) => records.get(key),
		set: (key, value) => {
			records.set(key, value);
		},
		snapshot: () => Object.fromEntries(records),
	};
}
