import { getIgniteConfig } from "../../config";
import { forgetQueuedStyles, injectStyles } from "../../styleHook";
import type { RenderStrategy } from "../RenderStrategy";
import { readBoundHostRuntime, withIgniteHostRuntime } from "./hostBridge";
import { isNoDiffDenylistedTag } from "./noDiffDenylist";
import {
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
	unmountIgniteSubtree,
} from "./renderer";
import type { IgniteJsxChild } from "./types";

declare const __IGNITE_DEV_WARNINGS__: boolean;
declare const __IGNITE_HOST_RUNTIME__: boolean | undefined;

const hostRuntimeEnabled =
	typeof __IGNITE_HOST_RUNTIME__ !== "undefined" && __IGNITE_HOST_RUNTIME__;

type FallbackLogging = "off" | "warn" | "debug";

function normalizeLogging(input: unknown): FallbackLogging {
	if (input === "debug" || input === "warn" || input === "off") {
		return input;
	}
	return "off";
}

function hostTag(contentRoot: HTMLElement | null): string | null {
	const host = (contentRoot?.getRootNode() as ShadowRoot | null)?.host;
	return host?.tagName?.toLowerCase() ?? null;
}

function logJsxFallback(
	logging: FallbackLogging,
	reason: string,
	tag: string | null,
): void {
	if (!__IGNITE_DEV_WARNINGS__ || logging === "off") return;
	const message = `[IgniteJsxRenderStrategy] Falling back to replace (${reason}${
		tag ? `, tag=${tag}` : ""
	})`;
	if (logging === "debug") {
		console.debug(message);
	} else {
		console.warn(message);
	}
}

const strategyLogging = new WeakMap<object, FallbackLogging>();
const strategyFallbackReason = new WeakMap<object, string>();

class IgniteJsxRenderStrategy implements RenderStrategy<IgniteJsxChild> {
	private contentRoot: HTMLElement | null = null;
	private previousTree: NormalizedNode[] | null = null;
	private readonly mode: "diff" | "replace";
	private readonly diffEnabled: boolean;
	private forceReplace = false;
	private writing = false;
	private next: [IgniteJsxChild] | undefined;

	constructor() {
		const { strategy, logging } = getIgniteConfig() ?? {};
		// Production and default builds compile this branch out, so they do not
		// reference process. The development build still honors the flag.
		const envFlag = __IGNITE_DEV_WARNINGS__
			? (
					globalThis as typeof globalThis & {
						process?: { env?: { IGNITE_DIFF_ENABLED?: string } };
					}
				).process?.env?.IGNITE_DIFF_ENABLED
			: undefined;
		this.diffEnabled = (envFlag ?? "true") !== "false";
		this.mode = strategy === "replace" ? "replace" : "diff";
		if (__IGNITE_DEV_WARNINGS__) {
			strategyLogging.set(this, normalizeLogging(logging));
		}
	}

	attach(host: ShadowRoot): void {
		// A later attach replays a parked shadow root. Ignite elements also
		// replay from connectedCallback. Light DOM uses the document observer.
		injectStyles(host);
		const existingRoot = host.querySelector<HTMLElement>(
			"[data-ignite-jsx-root]",
		);
		if (existingRoot) {
			this.contentRoot = existingRoot;
			return;
		}

		const root = document.createElement("ignite-jsx-root");
		root.setAttribute("data-ignite-jsx-root", "");
		host.appendChild(root);
		this.contentRoot = root;

		const hostElement = (host as ShadowRoot & { host?: Element }).host;
		const tagName = hostElement?.tagName?.toLowerCase();
		const isDenylistedHost = isNoDiffDenylistedTag(tagName);
		if (
			hostElement?.hasAttribute?.("data-ignite-nodiff") ||
			hostElement?.hasAttribute?.("data-ignite-hydrated") ||
			isDenylistedHost
		) {
			this.forceReplace = true;
			if (__IGNITE_DEV_WARNINGS__) {
				strategyFallbackReason.set(
					this,
					isDenylistedHost
						? `denylist:${tagName}`
						: hostElement?.hasAttribute?.("data-ignite-hydrated")
							? "hydrated"
							: "nodiff-attr",
				);
			}
		}
	}

	// A custom setter can call render() while the commit is still writing the
	// DOM, before the tree is published. A nested render would diff a stale
	// tree over a half-patched DOM, so it waits for the outer commit and the
	// newest request runs after it. Once the tree is published (refs, cleanups)
	// a nested render runs at once and supersedes anything still waiting.
	render(view: IgniteJsxChild): void {
		if (this.writing) {
			this.next = [view];
			return;
		}
		this.next = undefined;
		this.writing = true;
		try {
			this.renderNow(view);
		} finally {
			this.writing = false;
		}
		const queued = this.next;
		this.next = undefined;
		if (queued) this.render(queued[0]);
	}

	private renderNow(view: IgniteJsxChild): void {
		const contentRoot = this.contentRoot;
		if (!contentRoot) {
			throw new Error(
				"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		const mode = this.forceReplace || !this.diffEnabled ? "replace" : this.mode;
		const onTreePublished = (tree: NormalizedNode[]) => {
			this.previousTree = tree;
			this.writing = false;
		};
		const render = () =>
			this.previousTree === null
				? mountIgniteJsx(contentRoot, view, { onTreePublished })
				: renderIgniteJsx(contentRoot, view, this.previousTree, {
						mode,
						onTreePublished,
						onFallbackReplace: __IGNITE_DEV_WARNINGS__
							? (reason) =>
									logJsxFallback(
										strategyLogging.get(this) ?? "off",
										reason,
										hostTag(contentRoot),
									)
							: undefined,
					});
		if (hostRuntimeEnabled) {
			const rootNode = contentRoot.getRootNode();
			const runtime = readBoundHostRuntime(
				rootNode instanceof ShadowRoot ? rootNode.host : undefined,
			);
			withIgniteHostRuntime(runtime, render);
		} else {
			render();
		}

		if (__IGNITE_DEV_WARNINGS__) {
			const forceReason =
				strategyFallbackReason.get(this) ??
				(mode === "replace" && this.mode === "replace"
					? "config-replace"
					: !this.diffEnabled
						? "flag-disabled"
						: undefined);
			if (forceReason) {
				logJsxFallback(
					strategyLogging.get(this) ?? "off",
					forceReason,
					hostTag(this.contentRoot),
				);
			}
		}
	}

	releaseView(): void {
		if (!this.contentRoot) return;
		for (const child of Array.from(this.contentRoot.childNodes)) {
			unmountIgniteSubtree(child);
		}
	}

	detach(): void {
		const rootNode = this.contentRoot?.getRootNode();
		if (rootNode instanceof ShadowRoot) forgetQueuedStyles(rootNode);
		if (this.contentRoot) {
			unmountIgniteSubtree(this.contentRoot);
			this.contentRoot.parentNode?.removeChild(this.contentRoot);
		}
		this.contentRoot = null;
		this.previousTree = null;
	}
}

export const createIgniteJsxRenderStrategy = () =>
	new IgniteJsxRenderStrategy();

/** One-shot rootless JSX mount for static composition roots. */
export function mountIgniteJsxOnce(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
): void {
	mountIgniteJsx(host, view);
}

export type { IgniteJsxChild };
export {
	clearNoDiffDenylistForTests,
	registerNoDiffDenylistTag,
} from "./noDiffDenylist";
