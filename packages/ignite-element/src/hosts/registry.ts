import type { IgniteHostMap } from "./types";

const hostsByAdapter = new WeakMap<object, IgniteHostMap<never>>();

export function rememberCoreHosts<Snapshot>(
	adapterFactory: object,
	hosts: IgniteHostMap<Snapshot> | undefined,
): void {
	if (!hosts || Object.keys(hosts).length === 0) return;
	hostsByAdapter.set(adapterFactory, hosts as IgniteHostMap<never>);
}

export function coreHostsFor(
	adapterFactory: object,
): IgniteHostMap<never> | undefined {
	return hostsByAdapter.get(adapterFactory);
}

export function readReducedMotion(): boolean {
	if (typeof matchMedia !== "function") return false;
	try {
		return matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}
