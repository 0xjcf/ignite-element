function channel(hex: string, offset: number): number {
	const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
	return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
	const color = hex.startsWith("#") ? hex : `#${hex}`;
	return (
		0.2126 * channel(color, 1) +
		0.7152 * channel(color, 3) +
		0.0722 * channel(color, 5)
	);
}

/** WCAG 2 contrast ratio. */
export function contrastRatio(foreground: string, background: string): number {
	const lighter = Math.max(luminance(foreground), luminance(background));
	const darker = Math.min(luminance(foreground), luminance(background));
	return (lighter + 0.05) / (darker + 0.05);
}
