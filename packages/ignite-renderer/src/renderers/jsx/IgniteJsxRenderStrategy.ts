import { getIgniteConfig } from "../../config";
import injectStyles from "../../injectStyles";
import type { RenderStrategy } from "../RenderStrategy";
import { isNoDiffDenylistedTag } from "./noDiffDenylist";
import {
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
	unmountIgniteSubtree,
} from "./renderer";
import type { IgniteJsxChild } from "./types";

declare const __IGNITE_DEV_WARNINGS__: boolean;

class IgniteJsxRenderStrategy implements RenderStrategy<IgniteJsxChild> {
	private contentRoot: HTMLElement | null = null;
	private previousTree: NormalizedNode[] | null = null;
	private readonly mode: "diff" | "replace";
	private readonly logging: "off" | "warn" | "debug";
	private readonly diffEnabled: boolean;
	private forceReplace = false;
	private forceReplaceReason: string | null = null;

	private normalizeLogging(input: unknown): "off" | "warn" | "debug" {
		if (input === "debug" || input === "warn" || input === "off") {
			return input;
		}
		return "off";
	}

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
		this.logging = this.normalizeLogging(logging);
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
			this.forceReplaceReason = isDenylistedHost
				? `denylist:${tagName}`
				: hostElement?.hasAttribute?.("data-ignite-hydrated")
					? "hydrated"
					: "nodiff-attr";
		}
	}

	render(view: IgniteJsxChild): void {
		if (!this.contentRoot) {
			throw new Error(
				"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		const mode = this.forceReplace || !this.diffEnabled ? "replace" : this.mode;
		const forceReason =
			this.forceReplaceReason ??
			(mode === "replace" && this.mode === "replace"
				? "config-replace"
				: !this.diffEnabled
					? "flag-disabled"
					: null);

		this.previousTree =
			this.previousTree === null
				? mountIgniteJsx(this.contentRoot, view)
				: renderIgniteJsx(
						this.contentRoot,
						view,
						this.previousTree ?? undefined,
						{
							mode,
							onFallbackReplace: (reason) =>
								this.logFallback(reason, this.getHostTag()),
						},
					);

		if (forceReason) {
			this.logFallback(forceReason, this.getHostTag());
		}
	}

	releaseView(): void {
		if (!this.contentRoot) return;
		for (const child of Array.from(this.contentRoot.childNodes)) {
			unmountIgniteSubtree(child);
		}
	}

	detach(): void {
		if (this.contentRoot) {
			unmountIgniteSubtree(this.contentRoot);
			this.contentRoot.parentNode?.removeChild(this.contentRoot);
		}
		this.contentRoot = null;
		this.previousTree = null;
	}

	private getHostTag(): string | null {
		const host = (this.contentRoot?.getRootNode() as ShadowRoot | null)?.host;
		return host?.tagName?.toLowerCase() ?? null;
	}

	private logFallback(reason: string, tag: string | null): void {
		if (this.logging === "off") return;
		const message = `[IgniteJsxRenderStrategy] Falling back to replace (${reason}${
			tag ? `, tag=${tag}` : ""
		})`;
		if (this.logging === "debug") {
			console.debug(message);
		} else {
			console.warn(message);
		}
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
