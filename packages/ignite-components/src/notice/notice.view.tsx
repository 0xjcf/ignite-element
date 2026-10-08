/** @jsxImportSource ignite-element/jsx */
import { type IgniteJsxElement, jsx } from "ignite-element/jsx";
import { catalogHostStyles } from "../styles";
import type { NoticeCommands, NoticeStates } from "./notice.core";
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

function hostOf(current: EventTarget | null): HTMLElement | null {
	if (!(current instanceof Node)) return null;
	const root = current.getRootNode();
	return root instanceof ShadowRoot && root.host instanceof HTMLElement
		? root.host
		: null;
}

/**
 * After dismiss the panel is hidden, so the fallback is the host.
 * Capture the host before the command. A re-render detaches the button.
 * An external id wins when the page named one.
 */
function focusDefinedTarget(
	current: EventTarget | null,
	host: HTMLElement | null,
	targetId: string | null,
) {
	const node = current instanceof HTMLElement ? current : null;
	const doc = node?.ownerDocument ?? host?.ownerDocument ?? null;
	if (targetId && doc) {
		const external = doc.getElementById(targetId);
		const root = node?.getRootNode();
		const internal =
			root instanceof ShadowRoot ? root.getElementById(targetId) : null;
		const found = external ?? internal;
		if (found instanceof HTMLElement && found.isConnected) {
			if (found.tabIndex < 0) found.tabIndex = -1;
			found.focus();
			return;
		}
	}
	if (host instanceof HTMLElement && host.isConnected) {
		if (!host.hasAttribute("tabindex")) host.setAttribute("tabindex", "-1");
		host.focus();
	}
}

function recoveryButtons(
	tag: string,
	labels: readonly string[],
	targetId: string | null,
	recover: (label: string) => void,
): IgniteJsxElement {
	return jsx(tag, {
		class: "recovery",
		children: labels.map((label) =>
			jsx("button", {
				type: "button",
				onClick: (event: Event) => {
					const current = event.currentTarget;
					const host = hostOf(current);
					recover(label);
					focusDefinedTarget(current, host, targetId);
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
									(label) => {
										if (ctx.canRecover) ctx.recover(label);
									},
								)
							: null}
						{ctx.canDismiss ? (
							<button
								type="button"
								class="dismiss"
								onClick={(event: Event) => {
									const current = event.currentTarget;
									const host = hostOf(current);
									ctx.dismiss();
									focusDefinedTarget(current, host, ctx.focusTarget);
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
