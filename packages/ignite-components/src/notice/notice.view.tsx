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
function recoveryHost(labels: readonly string[]): string {
	let hash = 2166136261;
	for (const label of labels) {
		for (let index = 0; index < label.length; index++) {
			hash ^= label.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		hash ^= 0x1f;
		hash = Math.imul(hash, 16777619);
	}
	return `x-recover-${(hash >>> 0).toString(36)}`;
}

function recoveryButtons(
	tag: string,
	labels: readonly string[],
	recover: (label: string) => void,
): IgniteJsxElement {
	return jsx(tag, {
		class: "recovery",
		children: labels.map((label) =>
			jsx("button", {
				type: "button",
				onClick: () => {
					recover(label);
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
				class="notice"
				data-tone={ctx.tone}
				role={assertive ? "alert" : "status"}
				hidden={ctx.showNotice ? undefined : true}
			>
				<p class="tone">{toneWord(ctx.tone)}</p>
				<p class="message">{ctx.message}</p>
				{ctx.actions.length > 0 || ctx.canDismiss ? (
					<div class="actions">
						{ctx.actions.length > 0
							? recoveryButtons(
									recoveryHost(ctx.actions),
									ctx.actions,
									(label) => {
										if (ctx.canRecover) ctx.recover(label);
									},
								)
							: null}
						{ctx.canDismiss ? (
							<button
								type="button"
								class="dismiss"
								onClick={() => {
									ctx.dismiss();
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
