import { describe, expect, it } from "vitest";
import { workbenchStyles } from "./styles";

type Rgb = readonly [red: number, green: number, blue: number];

const tokenColor = (name: string): Rgb => {
	const match = workbenchStyles.match(
		new RegExp(`--${name}:\\s*oklch\\(([-.\\d]+)\\s+([-.\\d]+)\\s+([-.\\d]+)`),
	);
	if (!match) throw new Error(`Missing opaque OKLCH token --${name}.`);
	const lightness = Number(match[1]);
	const chroma = Number(match[2]);
	const hue = (Number(match[3]) * Math.PI) / 180;
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);
	const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const s = lightness - 0.0894841775 * a - 1.291485548 * b;
	const linear: Rgb = [
		4.0767416621 * l ** 3 - 3.3077115913 * m ** 3 + 0.2309699292 * s ** 3,
		-1.2684380046 * l ** 3 + 2.6097574011 * m ** 3 - 0.3413193965 * s ** 3,
		-0.0041960863 * l ** 3 - 0.7034186147 * m ** 3 + 1.707614701 * s ** 3,
	];
	return linear.map((channel) => {
		const encoded =
			channel <= 0.0031308
				? 12.92 * channel
				: 1.055 * channel ** (1 / 2.4) - 0.055;
		return Math.min(1, Math.max(0, encoded));
	}) as unknown as Rgb;
};

const composite = (foreground: Rgb, background: Rgb, alpha: number): Rgb =>
	foreground.map(
		(channel, index) =>
			channel * alpha + (background[index] ?? 0) * (1 - alpha),
	) as unknown as Rgb;

const luminance = (color: Rgb): number => {
	const linear = color.map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
	);
	return (
		0.2126 * (linear[0] ?? 0) +
		0.7152 * (linear[1] ?? 0) +
		0.0722 * (linear[2] ?? 0)
	);
};

const contrast = (foreground: Rgb, background: Rgb): number => {
	const lighter = Math.max(luminance(foreground), luminance(background));
	const darker = Math.min(luminance(foreground), luminance(background));
	return (lighter + 0.05) / (darker + 0.05);
};

describe("voice workbench contrast tokens", () => {
	it("binds every visible control family to the global 44px target token", () => {
		expect(workbenchStyles).toContain("--target-min: 2.75rem;");
		expect(workbenchStyles).toMatch(
			/\.icon-button\s*\{[^}]*min-width:\s*var\(--target-min\);[^}]*flex-shrink:\s*0;[^}]*\}/,
		);
		const targetRule = workbenchStyles.match(
			/([^{}]+)\{\s*min-height:\s*var\(--target-min\);\s*\}/,
		)?.[1];
		expect(targetRule).toBeDefined();
		for (const selector of [
			".switch",
			".icon-button",
			".button",
			".send-button",
			".text-button",
			".segmented button",
			".node-action",
			".source-link",
			".doc-card input",
			".mobile-tabs button",
		]) {
			expect(targetRule, selector).toContain(selector);
		}
	});

	it("keeps opaque and translucent text pairs at WCAG AA contrast", () => {
		const background = tokenColor("background");
		const elevated = tokenColor("background-elevated");
		const surface = tokenColor("surface");
		const foreground = tokenColor("foreground");
		const foregroundSoft = tokenColor("foreground-soft");
		const muted = tokenColor("muted");
		const primary = tokenColor("primary");
		const primaryInk = tokenColor("primary-ink");
		const speech = tokenColor("speech");
		const speechInk = tokenColor("speech-ink");
		const warning = tokenColor("warning");
		const danger = tokenColor("danger");
		const pairs = {
			"foreground / background": contrast(foreground, background),
			"foreground-soft / elevated": contrast(foregroundSoft, elevated),
			"muted / surface": contrast(muted, surface),
			"foreground-soft / surface-glass": contrast(
				foregroundSoft,
				composite(surface, elevated, 0.88),
			),
			"primary / primary-wash": contrast(
				primary,
				composite(primary, elevated, 0.12),
			),
			"primary-ink / primary": contrast(primaryInk, primary),
			"speech / speech-wash": contrast(
				speech,
				composite(speech, elevated, 0.13),
			),
			"speech-ink / speech": contrast(speechInk, speech),
			"warning / warning-wash": contrast(
				warning,
				composite(warning, elevated, 0.1),
			),
			"foreground-soft / danger-wash": contrast(
				foregroundSoft,
				composite(danger, elevated, 0.08),
			),
		};

		for (const [label, ratio] of Object.entries(pairs)) {
			expect(ratio, label).toBeGreaterThanOrEqual(4.5);
		}
	});
});
