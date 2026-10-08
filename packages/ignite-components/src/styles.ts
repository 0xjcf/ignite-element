/**
 * Shared catalog colors. Text is always the dark ink on a light fill.
 * Tone colors are borders and fills, never the only carrier of meaning.
 */
export const catalogColors = {
	fg: "#1c1915",
	muted: "#4a453c",
	bg: "#f7f4ee",
	surface: "#fffdf8",
	line: "#d9d2c5",
	info: "#1d4e89",
	infoFill: "#e7f0fa",
	success: "#0f6b4c",
	successFill: "#e5f4ec",
	warning: "#8a4b08",
	warningFill: "#fbf0e2",
	danger: "#8f1d1d",
	dangerFill: "#f8e8e8",
} as const;

export const catalogTokens = [
	"--catalog-fg",
	"--catalog-muted",
	"--catalog-bg",
	"--catalog-surface",
	"--catalog-line",
	"--catalog-font",
] as const;

export function catalogHostStyles(): string {
	return `:host {
  --catalog-fg: ${catalogColors.fg};
  --catalog-muted: ${catalogColors.muted};
  --catalog-bg: ${catalogColors.bg};
  --catalog-surface: ${catalogColors.surface};
  --catalog-line: ${catalogColors.line};
  --catalog-font: "Segoe UI", "Helvetica Neue", sans-serif;
  color: var(--catalog-fg);
  font-family: var(--catalog-font);
  font-size: 16px;
  line-height: 1.4;
}`;
}
