/** @jsxImportSource ignite-element/jsx */
import { type IgniteJsxElement, jsx } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import {
	type NoticeCommands,
	type NoticeStates,
	noticeFallbackFocusId,
} from "./notice.core";
import { toneWord } from "./notice.source";

export type NoticeViewContext = NoticeStates & NoticeCommands;

const styles = `${catalogHostStyles()}
:host { display: block; max-width: 40rem; }
.notice {
  padding: 0.85rem 1rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 8px;
  background: var(--catalog-surface);
  color: var(--catalog-fg);
}
.notice[data-tone="info"],
.notice[data-tone="stale"] {
  border-color: #1d4e89;
  background: #e7f0fa;
}
.notice[data-tone="warning"],
.notice[data-tone="ai-off"] {
  border-color: #8a4b08;
  background: #fbf0e2;
}
.notice[data-tone="error"] {
  border-color: #8f1d1d;
  background: #f8e8e8;
}
.tone {
  margin: 0 0 0.3rem;
  font: 650 0.78rem/1.3 var(--catalog-font);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.message { margin: 0; color: var(--catalog-fg); }
.actions, .recovery {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.actions { margin-top: 0.75rem; }
button {
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.45rem 0.9rem;
  border: 1px solid var(--catalog-fg);
  border-radius: 6px;
  background: var(--catalog-fg);
  color: var(--catalog-surface);
  font: 600 0.95rem/1.2 var(--catalog-font);
}
button.dismiss {
  background: var(--catalog-surface);
  color: var(--catalog-fg);
}
`;

/**
 * The tone word is text. Color only tints the panel.
 * Recovery asks the host. Dismiss hides the notice until the host shows it again.
 */
function recoveryHost(instanceId: string, labels: readonly string[]): string {
	let hash = 2166136261;
	for (const label of labels) {
		for (let index = 0; index < label.length; index++) {
			hash ^= label.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		hash ^= 0x1f;
		hash = Math.imul(hash, 16777619);
	}
	return `x-recover-${instanceId}-${(hash >>> 0).toString(36)}`;
}

function componentHost(current: EventTarget | null): HTMLElement | null {
	if (!(current instanceof Node)) return null;
	const root = current.getRootNode();
	return root instanceof ShadowRoot && root.host instanceof HTMLElement
		? root.host
		: null;
}

/**
 * document.getElementById cannot see into a parent shadow root.
 * Walk outward from the clicked node through each host.
 * Call this before the command. A re-render detaches the button.
 */
function findFocusTarget(start: Node, id: string): HTMLElement | null {
	const light = start.ownerDocument?.getElementById(id) ?? null;
	if (light instanceof HTMLElement && light.isConnected) return light;
	let node: Node | null = start;
	const seen = new Set<Node>();
	while (node && !seen.has(node)) {
		seen.add(node);
		const root = node.getRootNode();
		if (!(root instanceof ShadowRoot)) break;
		const found = root.getElementById(id);
		if (found instanceof HTMLElement && found.isConnected) return found;
		node = root.host;
	}
	return null;
}

function placeFocus(found: HTMLElement) {
	if (found.tabIndex < 0) found.tabIndex = -1;
	found.focus();
}

/**
 * After dismiss the panel is hidden, so the fallback is the host.
 * The host id is the same id CLI and MCP report.
 */
function focusDefinedTarget(
	start: Node | null,
	host: HTMLElement | null,
	targetId: string | null,
	fallbackId: string,
) {
	if (targetId && start) {
		const found = findFocusTarget(start, targetId);
		if (found) {
			placeFocus(found);
			return;
		}
	}
	if (host instanceof HTMLElement && host.isConnected) {
		if (!host.id) host.id = fallbackId;
		if (!host.hasAttribute("tabindex")) host.setAttribute("tabindex", "-1");
		host.focus();
	}
}

function recoveryButtons(
	tag: string,
	labels: readonly string[],
	targetId: string | null,
	fallbackId: string,
	canRecover: boolean,
	recover: (label: string) => void,
): IgniteJsxElement {
	return jsx(tag, {
		class: "recovery",
		children: labels.map((label) =>
			jsx("button", {
				type: "button",
				disabled: canRecover ? undefined : true,
				onClick: (event: Event) => {
					if (!canRecover) return;
					const current = event.currentTarget;
					const host = componentHost(current);
					const start = current instanceof Node ? current : null;
					const found =
						targetId && start ? findFocusTarget(start, targetId) : null;
					recover(label);
					if (found) {
						placeFocus(found);
						return;
					}
					focusDefinedTarget(null, host, null, fallbackId);
				},
				children: [label],
			}),
		),
	});
}

export function noticeView(ctx: NoticeViewContext): IgniteJsxElement {
	const assertive = ctx.tone === "error" || ctx.tone === "warning";
	return (
		<>
			<style>{styles}</style>
			<section
				id={`${ctx.instanceId}-notice`}
				class="notice"
				data-tone={ctx.tone}
				role={assertive ? "alert" : "status"}
				aria-labelledby={`${ctx.instanceId}-message`}
				hidden={ctx.showNotice ? undefined : true}
			>
				<p class="tone">{toneWord(ctx.tone)}</p>
				<p id={`${ctx.instanceId}-message`} class="message">
					{ctx.message}
				</p>
				{ctx.actions.length > 0 || ctx.canDismiss ? (
					<div class="actions">
						{ctx.actions.length > 0
							? recoveryButtons(
									recoveryHost(ctx.instanceId, ctx.actions),
									ctx.actions,
									ctx.focusTarget,
									noticeFallbackFocusId(ctx.instanceId),
									ctx.canRecover,
									(label) => {
										ctx.recover(label);
									},
								)
							: null}
						{ctx.canDismiss ? (
							<button
								type="button"
								class="dismiss"
								onClick={(event: Event) => {
									const current = event.currentTarget;
									const host = componentHost(current);
									const start = current instanceof Node ? current : null;
									const found =
										ctx.focusTarget && start
											? findFocusTarget(start, ctx.focusTarget)
											: null;
									ctx.dismiss();
									if (found) {
										placeFocus(found);
										return;
									}
									focusDefinedTarget(
										null,
										host,
										null,
										noticeFallbackFocusId(ctx.instanceId),
									);
								}}
							>
								Dismiss
							</button>
						) : null}
					</div>
				) : null}
			</section>
		</>
	);
}
