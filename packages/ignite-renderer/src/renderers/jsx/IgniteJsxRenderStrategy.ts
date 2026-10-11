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

	render(view: IgniteJsxChild): void {
		const contentRoot = this.contentRoot;
		if (!contentRoot) {
			throw new Error(
				"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		const mode = this.forceReplace || !this.diffEnabled ? "replace" : this.mode;
		const render = () =>
			this.previousTree === null
				? mountIgniteJsx(contentRoot, view)
				: renderIgniteJsx(contentRoot, view, this.previousTree ?? undefined, {
						mode,
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
			this.previousTree = withIgniteHostRuntime(runtime, render);
		} else {
			this.previousTree = render();
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
