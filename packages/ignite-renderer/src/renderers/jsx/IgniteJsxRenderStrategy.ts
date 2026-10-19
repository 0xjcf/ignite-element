import { getIgniteConfig } from "../../config";
import { forgetQueuedStyles, injectStyles } from "../../styleHook";
import type { RenderStrategy } from "../RenderStrategy";
import { readBoundHostRuntime, withIgniteHostRuntime } from "./hostBridge";
import { isNoDiffDenylistedTag } from "./noDiffDenylist";
import {
	detaching,
	mountIgniteJsx,
	type NormalizedNode,
	renderIgniteJsx,
	setOwner,
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

// A rootless mount into a strategy's own root leaves its cached tree stale.
// The mark lives on the root under a shared key, so a mount made by another
// bundled copy of this module is seen too.
const mounted = Symbol.for("ignite.m");
type Marked = Record<symbol, unknown>;
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
	// newest request runs after it, even when the outer render throws. detach()
	// drops a waiting request. If both renders throw, the caller sees the first
	// error.
	// A render that throws before publishing leaves a DOM that no tree
	// describes, so the next render rebuilds it; until then it stays as left.
	// Once the tree is published (controlled flush, refs, cleanups) a nested
	// render runs at once; the renderer stops the outer controlled writes it
	// superseded.
	render(view: IgniteJsxChild): void {
		if (this.writing) {
			this.next = [view];
			return;
		}
		this.next = undefined;
		this.writing = true;
		let failure: [unknown] | undefined;
		try {
			this.renderNow(view);
		} catch (error) {
			failure = [error];
			this.previousTree = null;
		}
		this.writing = false;
		try {
			if (this.next) this.render(this.next[0]);
		} catch (error) {
			failure ??= [error];
		}
		if (failure) throw failure[0];
	}

	private renderNow(view: IgniteJsxChild): void {
		const contentRoot = this.contentRoot;
		if (!contentRoot) {
			throw new Error(
				"[IgniteJsxRenderStrategy] Cannot render before attach has been invoked.",
			);
		}

		const marks = contentRoot as unknown as Marked;
		if (marks[mounted]) {
			marks[mounted] = 0;
			this.previousTree = null;
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
		const root = this.contentRoot;
		if (!root) return;
		// A commit into the root while it releases is ignored, as in detach():
		// the release already took its snapshot, so it would never be released.
		setOwner(root, detaching);
		try {
			for (const child of Array.from(root.childNodes)) {
				unmountIgniteSubtree(child);
			}
		} finally {
			setOwner(root, {});
		}
	}

	detach(): void {
		const rootNode = this.contentRoot?.getRootNode();
		if (rootNode instanceof ShadowRoot) forgetQueuedStyles(rootNode);
		const root = this.contentRoot;
		this.previousTree = null;
		if (root) {
			// A cleanup that renders must wait: the unmount below already took its
			// snapshot, so a render now would create nodes nothing releases.
			const was = this.writing;
			this.writing = true;
			setOwner(root, detaching);
			try {
				unmountIgniteSubtree(root);
				root.parentNode?.removeChild(root);
				this.contentRoot = null;
			} finally {
				this.writing = was;
				// A teardown that threw keeps its root renderable: the next render
				// mounts the released view afresh. A root it already took out of
				// the tree is dropped instead, so attach creates a fresh one.
				if (!root.parentNode) this.contentRoot = null;
				else setOwner(root, {});
			}
		}
		// Last: a disposer or hook above may have queued a render of its own.
		this.next = undefined;
	}
}

export const createIgniteJsxRenderStrategy = () =>
	new IgniteJsxRenderStrategy();

/** One-shot rootless JSX mount for static composition roots. */
export function mountIgniteJsxOnce(
	host: (Node & ParentNode) | ShadowRoot,
	view: IgniteJsxChild,
): void {
	(host as unknown as Marked)[mounted] = 1;
	mountIgniteJsx(host, view);
}

export type { IgniteJsxChild };
export {
	clearNoDiffDenylistForTests,
	registerNoDiffDenylistTag,
} from "./noDiffDenylist";
