export const workbenchStyles = `
	:host {
		color-scheme: dark;
		--font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
		--background: oklch(0.13 0.018 250);
		--background-elevated: oklch(0.16 0.022 250);
		--surface: oklch(0.19 0.024 250);
		--surface-raised: oklch(0.23 0.027 250);
		--surface-hover: oklch(0.27 0.03 250);
		--surface-glass: color-mix(in oklab, var(--surface) 88%, transparent);
		--foreground: oklch(0.96 0.012 240);
		--foreground-soft: oklch(0.78 0.025 245);
		--muted: oklch(0.64 0.025 245);
		--border: oklch(0.31 0.03 250);
		--border-strong: oklch(0.4 0.045 245);
		--primary: oklch(0.84 0.21 145);
		--primary-strong: oklch(0.74 0.2 145);
		--primary-ink: oklch(0.16 0.04 145);
		--primary-wash: color-mix(in oklab, var(--primary) 12%, transparent);
		--speech: oklch(0.8 0.13 220);
		--speech-strong: oklch(0.69 0.15 225);
		--speech-ink: oklch(0.16 0.035 225);
		--speech-wash: color-mix(in oklab, var(--speech) 13%, transparent);
		--warning: oklch(0.83 0.16 82);
		--danger: oklch(0.72 0.19 25);
		--focus: oklch(0.88 0.15 210);
		--shadow-color: oklch(0.05 0.02 250 / 0.56);
		--shadow-sm: 0 8px 24px var(--shadow-color);
		--shadow-lg: 0 26px 80px var(--shadow-color);
		--radius-sm: 0.55rem;
		--radius-md: 0.8rem;
		--radius-lg: 1.1rem;
		--radius-xl: 1.4rem;
		--space-1: 0.25rem;
		--space-2: 0.5rem;
		--space-3: 0.75rem;
		--space-4: 1rem;
		--space-5: 1.25rem;
		--space-6: 1.5rem;
		--space-8: 2rem;
		--target-min: 2.75rem;
		display: block;
		min-width: 20rem;
		min-height: 100vh;
		background:
			radial-gradient(circle at 7% -10%, var(--primary-wash), transparent 28rem),
			radial-gradient(circle at 92% 3%, var(--speech-wash), transparent 31rem),
			var(--background);
		color: var(--foreground);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	* { box-sizing: border-box; }
	button, textarea, input { font: inherit; }
	button { color: inherit; }
	button:focus-visible, textarea:focus-visible, input:focus-visible, [role="tab"]:focus-visible {
		outline: 0.15rem solid var(--focus);
		outline-offset: 0.15rem;
	}
	button:disabled, textarea:disabled { cursor: not-allowed; opacity: 0.48; }
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.shell {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		min-height: 100vh;
		max-width: 112rem;
		margin: 0 auto;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-height: 4.25rem;
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--border);
		background: color-mix(in oklab, var(--background-elevated) 84%, transparent);
		backdrop-filter: blur(1.5rem);
		position: sticky;
		top: 0;
		z-index: 20;
	}
	.brand { display: flex; align-items: center; gap: 0.7rem; min-width: 14rem; }
	.brand-mark {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 0.7rem;
		background: linear-gradient(145deg, var(--primary), var(--speech));
		color: var(--primary-ink);
		box-shadow: 0 0 2rem var(--primary-wash);
		font-weight: 900;
	}
	.brand-copy { display: grid; line-height: 1.1; }
	.brand-copy strong { font-size: 0.95rem; letter-spacing: -0.015em; }
	.brand-copy span { color: var(--muted); font-size: 0.7rem; margin-top: 0.2rem; }
	.topbar-center { display: flex; gap: var(--space-2); align-items: center; flex: 1; justify-content: center; }
	.top-actions { display: flex; align-items: center; justify-content: flex-end; min-width: 14rem; }
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 1.8rem;
		padding: 0.24rem 0.62rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-glass);
		color: var(--foreground-soft);
		font-size: 0.72rem;
		font-weight: 650;
		white-space: nowrap;
	}
	.pill-success { border-color: var(--primary); background: var(--primary-wash); color: var(--primary); }
	.pill-preparing { border-color: var(--warning); background: color-mix(in oklab, var(--warning) 10%, transparent); color: var(--warning); }
	.pill-failed { border-color: var(--danger); background: color-mix(in oklab, var(--danger) 10%, transparent); color: var(--danger); }
	.pill-speech { border-color: var(--speech); background: var(--speech-wash); color: var(--speech); }
	.dot { width: 0.42rem; height: 0.42rem; border-radius: 50%; background: currentColor; box-shadow: 0 0 0.8rem currentColor; }
	.switch { display: inline-flex; align-items: center; gap: 0.55rem; color: var(--foreground-soft); font-size: 0.76rem; cursor: pointer; }
	.switch input { position: absolute; opacity: 0; pointer-events: none; }
	.switch-track { width: 2.45rem; height: 1.42rem; padding: 0.17rem; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface-raised); }
	.switch-track::after { content: ""; display: block; width: 0.95rem; height: 0.95rem; border-radius: 50%; background: var(--muted); transition: transform 180ms ease, background 180ms ease; }
	.switch input:checked + .switch-track { background: var(--speech-wash); border-color: var(--speech); }
	.switch input:checked + .switch-track::after { transform: translateX(1rem); background: var(--speech); }

	.workspace {
		display: grid;
		grid-template-columns: minmax(17rem, 0.78fr) minmax(28rem, 1.65fr) minmax(17rem, 0.78fr);
		min-height: 0;
		height: calc(100vh - 7.5rem);
	}
	.panel { min-width: 0; min-height: 0; background: var(--background-elevated); }
	.panel + .panel { border-left: 1px solid var(--border); }
	.panel-head, .artifact-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: 3.6rem;
		padding: 0 var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	.panel-title, .artifact-identity { display: grid; gap: 0.08rem; min-width: 0; }
	.panel-title strong, .artifact-identity strong { font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.panel-title span, .artifact-identity span { color: var(--muted); font-family: var(--font-mono); font-size: 0.62rem; overflow: hidden; text-overflow: ellipsis; }

	.conversation { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
	.session-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); padding: var(--space-3) var(--space-4); border: 0; }
	.session-stat { display: flex; align-items: baseline; justify-content: center; gap: 0.3rem; min-width: 0; min-height: 2.35rem; padding: 0.45rem 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--foreground-soft); white-space: nowrap; }
	.session-stat strong { color: var(--foreground); font-size: 0.78rem; }
	.session-stat span { color: var(--muted); font-size: 0.62rem; }
	.session-stat-speech { border-color: var(--speech); background: var(--speech-wash); }
	.session-stat-speech strong { color: var(--speech); }
	.messages { overflow-y: auto; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); }
	.message { display: grid; gap: 0.4rem; max-width: 94%; animation: rise 240ms ease both; }
	.message-user { align-self: flex-end; }
	.message-meta { display: flex; align-items: center; gap: 0.4rem; color: var(--muted); font-size: 0.66rem; font-weight: 650; }
	.message-user .message-meta { justify-content: flex-end; }
	.message-bubble { padding: 0.72rem 0.85rem; border: 1px solid var(--border); border-radius: 0.9rem; background: var(--surface); color: var(--foreground-soft); font-size: 0.79rem; overflow-wrap: anywhere; }
	.message-user .message-bubble { border-color: var(--speech); background: var(--speech-wash); color: var(--foreground); border-bottom-right-radius: 0.25rem; }
	.message-agent .message-bubble { border-bottom-left-radius: 0.25rem; }
	.empty-chat { margin: auto; max-width: 17rem; text-align: center; color: var(--muted); }
	.empty-chat strong { display: block; color: var(--foreground-soft); margin-bottom: var(--space-2); }
	.typing { display: flex; gap: 0.25rem; align-items: center; height: 1rem; }
	.typing i { width: 0.35rem; height: 0.35rem; border-radius: 50%; background: var(--primary); animation: pulse 1s infinite; }
	.typing i:nth-child(2) { animation-delay: 140ms; }
	.typing i:nth-child(3) { animation-delay: 280ms; }

	.composer-wrap { padding: var(--space-3); border-top: 1px solid var(--border); background: var(--background-elevated); }
	.composer { border: 1px solid var(--border-strong); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-sm); }
	.composer:focus-within { border-color: var(--primary); box-shadow: 0 0 0 0.18rem var(--primary-wash), var(--shadow-sm); }
	.composer textarea { display: block; width: 100%; min-height: 5rem; max-height: 10rem; resize: vertical; padding: 0.85rem 0.9rem 0.4rem; border: 0; outline: 0; background: transparent; color: var(--foreground); font-size: 0.82rem; line-height: 1.45; }
	.composer textarea::placeholder { color: var(--muted); }
	.composer-actions { display: flex; align-items: center; gap: var(--space-2); padding: 0.45rem 0.5rem 0.5rem; }
	.input-mode { display: flex; align-items: center; gap: 0.35rem; margin-right: auto; color: var(--muted); font-size: 0.68rem; }
	.icon-button, .button, .send-button, .text-button { border: 1px solid var(--border); cursor: pointer; transition: border-color 150ms ease, background 150ms ease, transform 150ms ease; }
	.icon-button:hover, .button:hover, .text-button:hover { border-color: var(--border-strong); background: var(--surface-hover); }
	.icon-button { display: grid; place-items: center; width: 2.45rem; min-height: 2.45rem; padding: 0; border-radius: 0.7rem; background: var(--surface); color: var(--foreground-soft); }
	.send-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.42rem; min-height: 2.45rem; padding: 0.45rem 0.78rem; border-color: var(--primary); border-radius: 0.72rem; background: var(--primary); color: var(--primary-ink); font-size: 0.76rem; font-weight: 780; }
	.send-button:hover { background: var(--primary-strong); border-color: var(--primary-strong); }
	.voice-capture { display: none; padding: var(--space-3); border: 1px solid var(--speech); border-radius: var(--radius-lg); background: var(--speech-wash); }
	.shell[data-voice-state="listening"] .composer { display: none; }
	.shell[data-voice-state="listening"] .voice-capture,
	.shell[data-voice-state="transcript"] .voice-capture { display: grid; gap: var(--space-3); }
	.voice-top { display: flex; align-items: center; gap: var(--space-3); }
	.voice-orb { width: 2.65rem; height: 2.65rem; display: grid; place-items: center; border-radius: 50%; background: var(--speech); color: var(--speech-ink); box-shadow: 0 0 1.8rem var(--speech-wash); flex: none; }
	.voice-copy { display: grid; gap: 0.08rem; min-width: 0; }
	.voice-copy strong { font-size: 0.8rem; }
	.voice-copy span { color: var(--foreground-soft); font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.wave { margin-left: auto; height: 1.6rem; display: flex; align-items: center; gap: 0.18rem; }
	.wave i { width: 0.16rem; height: 30%; border-radius: 1rem; background: var(--speech); animation: wave 760ms ease-in-out infinite alternate; }
	.wave i:nth-child(2), .wave i:nth-child(6) { animation-delay: 120ms; height: 70%; }
	.wave i:nth-child(3), .wave i:nth-child(5) { animation-delay: 240ms; height: 100%; }
	.voice-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: var(--space-2); }
	.button { min-height: 2.4rem; padding: 0.45rem 0.7rem; border-radius: 0.7rem; background: var(--surface); font-size: 0.73rem; font-weight: 700; }
	.button-primary { border-color: var(--speech); background: var(--speech); color: var(--speech-ink); }
	.permission-note { display: none; margin: 0 0 var(--space-3); padding: var(--space-3); border: 1px solid var(--warning); border-radius: var(--radius-md); background: color-mix(in oklab, var(--warning) 10%, transparent); }
	.shell[data-voice-state="permission"] .permission-note { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2); }
	.permission-note strong { display: block; font-size: 0.75rem; }
	.permission-note p { margin: 0.12rem 0 0; color: var(--foreground-soft); font-size: 0.68rem; }
	.model-notice { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-2); align-items: start; margin: 0 0 var(--space-3); padding: var(--space-3); border: 1px solid var(--warning); border-radius: var(--radius-md); background: color-mix(in oklab, var(--warning) 8%, transparent); }
	.model-notice-failed { grid-template-columns: auto minmax(0, 1fr) auto; border-color: var(--danger); background: color-mix(in oklab, var(--danger) 8%, transparent); }
	.model-notice-icon { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; color: var(--warning); font-weight: 850; animation: pulse 1.6s ease-in-out infinite; }
	.model-notice-failed .model-notice-icon { color: var(--danger); animation: none; }
	.model-notice strong { display: block; font-size: 0.74rem; }
	.model-notice p { margin: 0.12rem 0 0; color: var(--foreground-soft); font-size: 0.66rem; }
	.model-retry { align-self: center; border-color: var(--danger); color: var(--foreground); }

	.artifact { display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--background); }
	.artifact-toolbar { background: var(--background-elevated); }
	.artifact-identity { margin-right: auto; }
	.segmented { display: flex; gap: 0.15rem; padding: 0.18rem; border: 1px solid var(--border); border-radius: 0.7rem; background: var(--surface); }
	.segmented button { min-height: 2rem; padding: 0.28rem 0.6rem; border: 0; border-radius: 0.52rem; background: transparent; color: var(--muted); cursor: pointer; font-size: 0.68rem; font-weight: 700; }
	.segmented button[aria-selected="true"] { background: var(--surface-raised); color: var(--foreground); box-shadow: var(--shadow-sm); }
	.artifact-scroll { position: relative; overflow-y: auto; padding: clamp(1.1rem, 2.6vw, 2.4rem); scroll-behavior: smooth; }
	.artifact-switcher { width: min(100%, 70rem); margin: 0 auto var(--space-3); display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-3); align-items: center; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface-glass); }
	.artifact-switcher-label, .revision-history-label { display: grid; gap: 0.08rem; min-width: 7rem; }
	.artifact-switcher-label strong, .revision-history-label strong { font-size: 0.7rem; }
	.artifact-switcher-label span, .revision-history-label span { color: var(--muted); font-size: 0.58rem; }
	.artifact-switcher-list, .revision-history-list { min-width: 0; display: flex; gap: var(--space-2); overflow-x: auto; padding: 0.1rem; scrollbar-width: thin; }
	.artifact-switcher-item, .revision-history-list button { flex: 0 0 auto; min-width: 8.5rem; min-height: var(--target-min); display: grid; gap: 0.08rem; align-content: center; padding: 0.5rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); text-align: left; }
	.artifact-switcher-item strong, .revision-history-list strong { overflow: hidden; color: var(--foreground-soft); font-size: 0.66rem; text-overflow: ellipsis; white-space: nowrap; }
	.artifact-switcher-item span, .revision-history-list span { color: var(--muted); font-family: var(--font-mono); font-size: 0.56rem; }
	.artifact-switcher-item:hover:not(:disabled), .revision-history-list button:hover:not(:disabled) { border-color: var(--border-strong); background: var(--surface-hover); }
	.artifact-switcher-item.is-active, .revision-history-list button.is-current { border-color: var(--primary); background: var(--primary-wash); }
	.proof-banner { width: min(100%, 70rem); margin: 0 auto var(--space-3); padding: 0.72rem 0.85rem; display: grid; grid-template-columns: auto 1fr; gap: var(--space-3); align-items: center; border: 1px solid var(--primary); border-radius: var(--radius-md); background: var(--primary-wash); }
	.proof-banner strong { display: block; font-size: 0.72rem; }
	.proof-banner span { display: block; margin-top: 0.08rem; color: var(--foreground-soft); font-size: 0.66rem; }
	.document, .schema-view, .empty-artifact, .model-state { width: min(100%, 70rem); min-height: 100%; margin: 0 auto; padding: clamp(1.25rem, 3vw, 3rem); border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--background-elevated); box-shadow: var(--shadow-lg); }
	.empty-artifact { display: grid; place-items: center; text-align: center; }
	.empty-artifact div { max-width: 28rem; }
	.empty-artifact strong { display: block; margin-bottom: var(--space-2); font-size: 1.15rem; }
	.empty-artifact p { margin: 0; color: var(--foreground-soft); }
	.model-state { display: grid; place-items: center; align-content: center; gap: var(--space-3); text-align: center; border-color: color-mix(in oklab, var(--warning) 42%, var(--border)); }
	.model-state-failed { border-color: color-mix(in oklab, var(--danger) 50%, var(--border)); }
	.model-state-mark { display: grid; place-items: center; width: 3.4rem; height: 3.4rem; border: 1px solid var(--warning); border-radius: 1rem; background: color-mix(in oklab, var(--warning) 9%, transparent); color: var(--warning); box-shadow: 0 0 2.5rem color-mix(in oklab, var(--warning) 16%, transparent); }
	.model-state-failed .model-state-mark { border-color: var(--danger); background: color-mix(in oklab, var(--danger) 9%, transparent); color: var(--danger); }
	.model-state > strong { font-size: 1.15rem; }
	.model-state > p { max-width: 34rem; margin: 0; color: var(--foreground-soft); }
	.model-state-detail { color: var(--muted); font-family: var(--font-mono); font-size: 0.64rem; }
	.model-progress { width: min(100%, 22rem); height: 0.28rem; margin: var(--space-2) 0; overflow: hidden; border-radius: 999px; background: var(--surface-raised); }
	.model-progress i { display: block; width: 38%; height: 100%; border-radius: inherit; background: var(--warning); animation: model-progress 1.4s ease-in-out infinite alternate; }
	.doc-kicker { display: flex; align-items: center; gap: var(--space-2); color: var(--primary); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
	.doc-kicker::before { content: ""; width: 1.7rem; height: 0.12rem; border-radius: 1rem; background: var(--primary); }
	.document h1 { max-width: 43rem; margin: var(--space-5) 0 var(--space-3); font-size: clamp(1.8rem, 3.4vw, 3.25rem); line-height: 1.02; letter-spacing: -0.045em; }
	.revision-history { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-3); align-items: center; margin-top: var(--space-5); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--background); }
	.doc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); margin-top: var(--space-8); }
	.doc-card { min-width: 0; margin: 0; padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); overflow: auto; }
	.doc-card[data-node-kind="table"], .doc-card[data-node-kind="code-diff"], .doc-card[data-node-kind="chart"] { grid-column: 1 / -1; }
	.doc-card h2, .doc-card h3 { margin: 0 0 var(--space-3); font-size: 0.8rem; }
	.doc-card p { color: var(--foreground-soft); }
	.node-kind { float: right; margin-left: var(--space-2); padding: 0.16rem 0.38rem; border: 1px solid var(--border); border-radius: 0.38rem; color: var(--muted); font-family: var(--font-mono); font-size: 0.52rem; font-weight: 550; }
	.checklist, .timeline { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
	.checklist li { color: var(--foreground-soft); font-size: 0.76rem; }
	.doc-card label { display: grid; gap: var(--space-1); margin-top: var(--space-3); color: var(--foreground-soft); }
	.doc-card .checklist label { display: flex; align-items: center; gap: var(--space-2); min-height: var(--target-min); margin: 0; cursor: pointer; }
	.doc-card .checklist input[type="checkbox"] { flex: none; width: 1.15rem; min-height: 1.15rem; margin: 0; padding: 0; accent-color: var(--primary); }
	.checklist input:disabled { cursor: not-allowed; opacity: 0.48; }
	.checklist span { line-height: 1.35; }
	.doc-card input:not([type="checkbox"]) { width: 100%; min-height: 2.4rem; padding: 0 var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); color: var(--foreground); }
	.doc-card table { width: 100%; border-collapse: collapse; }
	.doc-card th, .doc-card td { padding: var(--space-2); border-bottom: 1px solid var(--border); text-align: left; }
	.source-link { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--speech); font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700; text-decoration-thickness: 0.08rem; text-underline-offset: 0.16rem; overflow-wrap: anywhere; }
	.source-link:hover { color: var(--foreground); }
	.doc-card time, .doc-card code, .schema-view pre { color: var(--muted); font-family: var(--font-mono); }
	.doc-card pre { overflow: auto; padding: var(--space-3); background: var(--background); border-radius: var(--radius-sm); }
	.doc-card progress { width: 100%; accent-color: var(--primary); }
	.node-action { min-height: 2.4rem; padding: 0 var(--space-3); border: 1px solid var(--primary); border-radius: var(--radius-sm); background: var(--primary); color: var(--primary-ink); font-weight: 750; }
	.schema-view { display: none; }
	.schema-view pre { margin: 0; overflow: auto; font-size: 0.72rem; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
	.artifact[data-view="schema"] .document,
	.artifact[data-view="schema"] .empty-artifact,
	.artifact[data-view="schema"] .model-state { display: none; }
	.artifact[data-view="schema"] .schema-view { display: block; }
	.responding-overlay { display: none; position: absolute; inset: 0; align-items: center; justify-content: center; padding: var(--space-6); background: color-mix(in oklab, var(--background) 72%, transparent); backdrop-filter: blur(0.4rem); z-index: 5; }
	.shell[data-actor-state="responding"] .responding-overlay { display: flex; }
	.progress-card { width: min(100%, 27rem); padding: var(--space-6); border: 1px solid var(--border-strong); border-radius: var(--radius-xl); background: var(--surface-glass); box-shadow: var(--shadow-lg); }
	.progress-card strong { display: block; font-size: 0.86rem; }
	.progress-card span { color: var(--muted); font-size: 0.7rem; }
	.progress-steps { display: grid; gap: 0.55rem; margin-top: var(--space-5); }
	.progress-step { display: flex; align-items: center; gap: var(--space-2); color: var(--muted); font-size: 0.7rem; }
	.progress-step::before { content: ""; width: 0.48rem; height: 0.48rem; border: 1px solid var(--border-strong); border-radius: 50%; }
	.progress-step.done { color: var(--foreground-soft); }
	.progress-step.done::before { border-color: var(--primary); background: var(--primary); }
	.progress-step.active { color: var(--primary); }
	.progress-step.active::before { border-color: var(--primary); box-shadow: 0 0 0 0.28rem var(--primary-wash); }

	.runtime { display: grid; grid-template-rows: auto minmax(0, 1fr); }
	.runtime-scroll { overflow-y: auto; padding: var(--space-3); display: grid; grid-auto-rows: max-content; align-content: start; gap: var(--space-3); }
	.runtime-card { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--surface); overflow: hidden; }
	.runtime-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: 2.55rem; padding: 0 var(--space-3); border-bottom: 1px solid var(--border); }
	.runtime-card-head strong { font-size: 0.72rem; }
	.runtime-card-head span { color: var(--muted); font-family: var(--font-mono); font-size: 0.58rem; }
	.component-contract, .runtime-body { padding: var(--space-3); display: grid; gap: var(--space-3); }
	.component-line { padding: 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.61rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.component-line strong { color: var(--primary); }
	.component-uses { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
	.component-use { display: grid; place-items: center; min-height: 2rem; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--foreground-soft); font-size: 0.57rem; font-weight: 700; text-align: center; }
	.runtime-fact { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.1rem var(--space-2); padding: 0.6rem; border: 1px solid var(--warning); border-radius: var(--radius-sm); background: color-mix(in oklab, var(--warning) 8%, transparent); }
	.runtime-fact > span { color: var(--foreground-soft); font-size: 0.61rem; font-weight: 700; }
	.runtime-fact > strong { color: var(--warning); font-family: var(--font-mono); font-size: 0.61rem; }
	.runtime-fact > small { grid-column: 1 / -1; color: var(--muted); font-size: 0.56rem; }
	.actor-state { display: grid; grid-template-columns: auto 1fr; gap: var(--space-3); align-items: center; }
	.state-node { width: 2rem; height: 2rem; display: grid; place-items: center; border: 1px solid var(--primary); border-radius: 0.65rem; background: var(--primary-wash); color: var(--primary); }
	.actor-copy { display: grid; gap: 0.12rem; min-width: 0; }
	.actor-copy strong, .latest-fact { font-family: var(--font-mono); font-size: 0.62rem; overflow-wrap: anywhere; }
	.actor-copy span, .latest-fact { color: var(--muted); }
	.actor-match { margin: 0; min-width: 0; color: var(--muted); font-family: var(--font-mono); font-size: 0.62rem; line-height: 1.55; white-space: pre-wrap; }
	.actor-match code { font: inherit; white-space: inherit; }
	.actor-copy code { color: var(--primary); }
	.capability-outcomes { display: grid; gap: 0.35rem; }
	.capability-outcomes > strong { font-size: 0.62rem; }
	.capability-outcomes > span { color: var(--muted); font-size: 0.57rem; }
	.domain-policy-proof { display: grid; gap: 0.55rem; padding: 0.65rem; border: 1px solid var(--accent); border-radius: var(--radius-sm); background: color-mix(in oklab, var(--accent) 7%, transparent); }
	.domain-policy-proof > header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
	.domain-policy-proof > header strong { color: var(--foreground); font-size: 0.64rem; }
	.domain-policy-proof > header span { color: var(--accent); font-family: var(--font-mono); font-size: 0.56rem; font-weight: 700; }
	.domain-policy-proof > p { margin: 0; color: var(--foreground-soft); font-size: 0.58rem; line-height: 1.45; }
	.domain-policy-identity { display: grid; gap: 0.3rem; margin: 0; }
	.domain-policy-identity > div { display: grid; grid-template-columns: minmax(4rem, 0.42fr) minmax(0, 1fr); gap: var(--space-2); }
	.domain-policy-identity dt, .domain-policy-identity dd { margin: 0; font-size: 0.56rem; }
	.domain-policy-identity dt { color: var(--muted); }
	.domain-policy-identity dd { color: var(--foreground); }
	.domain-policy-list { display: grid; gap: 0.24rem; }
	.domain-policy-list > strong { color: var(--foreground-soft); font-size: 0.57rem; }
	.domain-policy-list ul { display: grid; gap: 0.18rem; margin: 0; padding-left: 1rem; }
	.domain-policy-list li { color: var(--muted); font-size: 0.55rem; line-height: 1.4; }
	.capability-outcome { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.05rem var(--space-2); padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); }
	.capability-outcome strong { color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.56rem; }
	.capability-outcome span { color: var(--warning); font-family: var(--font-mono); font-size: 0.54rem; }
	.capability-outcome small { grid-column: 1 / -1; color: var(--muted); font-size: 0.54rem; }
	.turn-trace { margin: 0; padding: var(--space-2); list-style: none; display: grid; }
	.trace-step { position: relative; display: grid; grid-template-columns: auto 1fr; gap: var(--space-2); min-height: 2.55rem; padding: 0.45rem 0.5rem; color: var(--muted); }
	.trace-marker { width: 0.6rem; height: 0.6rem; margin-top: 0.22rem; border: 1px solid var(--primary); border-radius: 50%; background: var(--primary); }
	.trace-copy { display: grid; gap: 0.02rem; }
	.trace-copy strong { color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.61rem; }
	.trace-copy span { color: var(--muted); font-size: 0.57rem; }
	.collision-proof .trace-marker { border-color: var(--danger); background: var(--danger); }
	.preview-selectors { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.25rem; margin: 0; padding: var(--space-2); border: 0; }
	.preview-selectors button { min-width: 0; min-height: 2rem; padding: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); color: var(--muted); font-size: 0.54rem; text-transform: capitalize; cursor: pointer; }
	.preview-selectors button[aria-pressed="true"] { border-color: var(--primary); background: var(--primary-wash); color: var(--primary); }
	.projection-preview { min-height: 7rem; margin: 0 var(--space-2) var(--space-2); padding: 0.65rem; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background); color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.56rem; line-height: 1.55; white-space: pre-wrap; }
	.receipt-head { border-top: 1px solid var(--border); }
	.commit-list { padding: var(--space-2); display: grid; gap: var(--space-2); }
	.commit { display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-2); align-items: center; padding: 0.58rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); }
	.commit-icon { width: 1.65rem; height: 1.65rem; display: grid; place-items: center; border-radius: 0.5rem; background: var(--primary-wash); color: var(--primary); }
	.commit-terminal .commit-icon { color: var(--warning); }
	.commit-speech .commit-icon { color: var(--speech); }
	.commit-copy { display: grid; gap: 0.05rem; min-width: 0; }
	.commit-copy strong { font-size: 0.66rem; }
	.commit-copy span { color: var(--muted); font-size: 0.58rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.commit-status { color: var(--primary); font-family: var(--font-mono); font-size: 0.56rem; }
	.schema-section { display: grid; gap: 0.4rem; }
	.schema-section + .schema-section { padding-top: var(--space-3); border-top: 1px solid var(--border); }
	.schema-section > header { display: grid; gap: 0.05rem; }
	.schema-section > header strong { font-size: 0.64rem; }
	.schema-section > header span, .schema-section > p { margin: 0; color: var(--muted); font-size: 0.54rem; }
	.schema-section details { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--background-elevated); }
	.schema-section summary { display: grid; gap: 0.05rem; padding: 0.48rem; color: var(--foreground-soft); cursor: pointer; }
	.schema-section summary strong, .schema-section summary { font-family: var(--font-mono); font-size: 0.56rem; }
	.schema-section summary span { color: var(--primary); font-size: 0.52rem; }
	.schema-section details > p { margin: 0; padding: 0 0.48rem 0.35rem; color: var(--foreground-soft); font-size: 0.54rem; }
	.schema-section details > pre { max-height: 16rem; margin: 0; padding: 0.5rem; overflow: auto; border-top: 1px solid var(--border); color: var(--muted); font-family: var(--font-mono); font-size: 0.52rem; line-height: 1.55; white-space: pre-wrap; }
	.command-list { display: grid; gap: 0.35rem; }
	.command { color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.56rem; }
	.policy-proof { padding: 0.55rem; display: grid; grid-template-columns: auto 1fr; gap: var(--space-2); border: 1px solid var(--danger); border-radius: var(--radius-sm); background: color-mix(in oklab, var(--danger) 8%, transparent); }
	.policy-proof strong { display: block; color: var(--foreground-soft); font-family: var(--font-mono); font-size: 0.59rem; }
	.policy-proof span { display: block; margin-top: 0.08rem; color: var(--muted); font-size: 0.56rem; }
	.text-button { min-height: 2rem; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); background: var(--surface); color: var(--foreground-soft); font-size: 0.72rem; font-weight: 650; }
	.switch,
	.icon-button,
	.button,
	.send-button,
	.text-button,
	.segmented button,
	.node-action,
	.source-link,
	.doc-card input:not([type="checkbox"]),
	.mobile-tabs button { min-height: var(--target-min); }
	.icon-button {
		width: var(--target-min);
		min-width: var(--target-min);
		flex-shrink: 0;
	}

	.mobile-tabs { display: none; }
	.statusbar { display: flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 3.25rem; padding: 0 var(--space-4); border-top: 1px solid var(--border); background: var(--background-elevated); color: var(--muted); font-family: var(--font-mono); font-size: 0.6rem; }
	.statusbar strong { color: var(--foreground-soft); }

	@keyframes pulse { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-0.12rem); } }
	@keyframes wave { from { transform: scaleY(0.45); } to { transform: scaleY(1); } }
	@keyframes rise { from { opacity: 0; transform: translateY(0.35rem); } to { opacity: 1; transform: translateY(0); } }
	@keyframes model-progress { from { transform: translateX(-10%); } to { transform: translateX(175%); } }
	@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }
	@media (max-width: 72rem) {
		.workspace { grid-template-columns: minmax(17rem, 0.72fr) minmax(27rem, 1.45fr); }
		.runtime { display: none; }
		.runtime.is-mobile-active { display: grid; position: absolute; inset: 4.25rem 0 2.25rem; z-index: 12; }
		.topbar-center .pill:not(:first-child) { display: none; }
	}
	@media (max-width: 50rem) {
		:host { font-size: 0.9375rem; }
		.topbar { min-height: 4rem; padding: var(--space-2) var(--space-3); }
		.brand { min-width: 0; }
		.brand-copy span, .topbar-center, .top-actions { display: none; }
		.workspace { display: block; height: calc(100dvh - 7.95rem); min-height: 0; position: relative; overflow: hidden; }
		.panel { display: none; width: 100%; height: 100%; border-left: 0; }
		.panel.is-mobile-active { display: grid; }
		.runtime.is-mobile-active { position: static; inset: auto; }
		.mobile-tabs { display: grid; grid-template-columns: repeat(3, 1fr); min-height: 3.95rem; padding: 0.35rem; border-top: 1px solid var(--border); background: var(--background-elevated); }
		.mobile-tabs button { display: grid; place-items: center; align-content: center; min-height: 3.2rem; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--muted); font-size: 0.64rem; font-weight: 700; }
		.mobile-tabs button[aria-pressed="true"] { background: var(--primary-wash); color: var(--primary); }
		.statusbar { display: none; }
		.composer textarea { min-height: 4.3rem; font-size: 1rem; }
		.artifact-toolbar, .panel-head { padding: 0 var(--space-3); }
		.artifact-scroll { padding: var(--space-3); }
		.artifact-switcher, .revision-history { grid-template-columns: 1fr; }
		.document, .schema-view, .empty-artifact, .model-state { padding: var(--space-5); border-radius: var(--radius-lg); }
		.model-notice-failed { grid-template-columns: auto minmax(0, 1fr); }
		.model-retry { grid-column: 1 / -1; width: 100%; }
		.doc-grid { grid-template-columns: 1fr; }
		.doc-card[data-node-kind] { grid-column: auto; }
		.document h1 { font-size: 2rem; }
	}
	@media (max-width: 25rem) {
		.artifact-toolbar .pill { display: none; }
		.segmented button { padding-inline: 0.45rem; }
		.voice-actions { grid-template-columns: 1fr; }
	}
`;
