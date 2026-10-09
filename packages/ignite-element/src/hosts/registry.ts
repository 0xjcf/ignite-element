import type { IgniteHostDefinition } from "@ignite-element/renderer/jsx";
import type { IgniteHostMap } from "./types";

const hostsByAdapter = new WeakMap<object, IgniteHostMap>();

export function rememberCoreHosts(
	adapterFactory: object,
	hosts: IgniteHostMap | undefined,
): void {
	if (!hosts || Object.keys(hosts).length === 0) return;
	hostsByAdapter.set(adapterFactory, hosts);
}

export function coreHostsFor(
	adapterFactory: object,
): IgniteHostMap | undefined {
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

export type { IgniteHostDefinition };
