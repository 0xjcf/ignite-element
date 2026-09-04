#!/usr/bin/env node

/**
 * Docs theme contrast guardrail.
 *
 * Renders the BUILT docs site (docs/site/dist) in a headless Chromium, in both
 * the dark and light themes, and computes the WCAG contrast ratio for key chrome
 * (version/theme selects, search trigger) and content (sidebar, TOC, asides,
 * inline code, links) selectors. Fails when any element is below threshold:
 *   - UI controls:  >= 3:1
 *   - text/content: >= 4.5:1
 *
 * This codifies the manual audit from the version-picker dark-mode fix
 * (commit f2f61cb) and the token-driven theme refactor. It renders the real
 * page so it catches un-themed defaults and Astro-scoped component overrides
 * that a token-only check would miss (the version picker and search trigger
 * both broke that way).
 *
 * The contrast math composites alpha over the nearest opaque backdrop, so
 * translucent fills (inline code, asides) are measured against what actually
 * renders — a naive "ignore alpha" check false-positives on every inline code.
 *
 * It also runs a GEOMETRY guardrail: interactive controls (header selects,
 * search, hero buttons) must use the --radius-* scale and have non-zero
 * horizontal padding, catching un-tokenized geometry and the 0px-padding button
 * class of bug. Both checks share one render pass and one exit code.
 *
 * Usage:
 *   node scripts/check-contrast.mjs            # expects dist/ to exist
 *   npm run check:contrast    (build first)    # see package.json
 */

import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url)); // docs/site
const DIST = join(SITE_ROOT, "dist");
const BASE = "/ignite-element"; // must match astro.config.mjs `base`

const UI = 3; // WCAG AA for UI components / large text
const TEXT = 4.5; // WCAG AA for body text

// selector -> { sel, min }. `min` is the threshold for that element class.
const SELECTORS = {
	versionPicker: { sel: "starlight-version-select select", min: UI },
	themeToggle: { sel: "starlight-theme-select select", min: UI },
	search: { sel: "site-search button", min: UI },
	sidebar: { sel: ".sidebar-pane a", min: TEXT },
	toc: { sel: ".right-sidebar a", min: TEXT },
	pagination: { sel: ".pagination-links a span", min: TEXT },
	inlineCode: { sel: ".sl-markdown-content code:not(pre code)", min: TEXT },
	link: { sel: ".sl-markdown-content a", min: TEXT },
	aside: { sel: ".starlight-aside p", min: TEXT },
};

// Pages chosen to cover every selector at least once across both themes.
// The 2.x page keeps the archived (stable cyan) accent ramp under guard
// alongside the beta (green) ramp on current pages.
const PAGES = [
	"/getting-started/installation/",
	"/migration/v3/",
	"/2.x/getting-started/installation/",
];
const THEMES = ["dark", "light"];

// Geometry guardrail: interactive controls must use the radius scale and (where
// text sits inside) have non-zero horizontal padding. This catches un-tokenized
// geometry and the 0px-padding button class of bug. Geometry is theme-agnostic,
// so it's checked once. `needPadX` is false for the select boxes because their
// inner <select> carries the horizontal padding, not the label.
const RADIUS_SCALE_VARS = ["--radius-sm", "--radius-md", "--radius-lg"];
const GEOMETRY = [
	{
		path: "/getting-started/installation/",
		sel: "starlight-version-select label",
		needPadX: false,
	},
	{
		path: "/getting-started/installation/",
		sel: "starlight-theme-select label",
		needPadX: false,
	},
	{
		path: "/getting-started/installation/",
		sel: "site-search button",
		needPadX: true,
	},
	{ path: "/", sel: ".hero .actions a", needPadX: true },
];

const MIME = {
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".json": "application/json",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
	".xml": "application/xml",
	".txt": "text/plain",
};

/** Minimal static file server for dist/, serving under the configured base. */
function startServer() {
	const server = createServer(async (req, res) => {
		try {
			let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
			if (urlPath.startsWith(BASE)) urlPath = urlPath.slice(BASE.length);
			if (!urlPath || urlPath === "/") urlPath = "/index.html";
			// directory -> index.html
			let filePath = normalize(join(DIST, urlPath));
			if (!filePath.startsWith(DIST)) {
				res.writeHead(403).end("forbidden");
				return;
			}
			let info = await stat(filePath).catch(() => null);
			if (info?.isDirectory()) {
				filePath = join(filePath, "index.html");
				info = await stat(filePath).catch(() => null);
			}
			if (!info && !extname(filePath)) {
				filePath = `${filePath}/index.html`;
				info = await stat(filePath).catch(() => null);
			}
			if (!info) {
				res.writeHead(404).end("not found");
				return;
			}
			const body = await readFile(filePath);
			res.writeHead(200, {
				"content-type": MIME[extname(filePath)] || "application/octet-stream",
			});
			res.end(body);
		} catch {
			res.writeHead(500).end("error");
		}
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			resolve({ server, port });
		});
	});
}

/** Runs in the page: alpha-aware WCAG contrast ratio per selector. */
function auditInPage(selectorMap) {
	const parse = (s) => {
		const m = (s.match(/[\d.]+/g) || [0, 0, 0, 1]).map(Number);
		return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 };
	};
	const over = (fg, bg) => ({
		r: fg.r * fg.a + bg.r * (1 - fg.a),
		g: fg.g * fg.a + bg.g * (1 - fg.a),
		b: fg.b * fg.a + bg.b * (1 - fg.a),
	});
	const lum = ({ r, g, b }) => {
		const f = (v) => {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
	};
	// Nearest opaque backdrop, so translucent element fills composite correctly.
	const solidBg = (el) => {
		let n = el;
		while (n) {
			const c = parse(getComputedStyle(n).backgroundColor);
			if (c.a === 1) return c;
			n = n.parentElement;
		}
		return { r: 255, g: 255, b: 255 };
	};
	const ratio = (el) => {
		const cs = getComputedStyle(el);
		const back = solidBg(el);
		const fg = over(parse(cs.color), back);
		const ownBg = parse(cs.backgroundColor);
		const effBg = ownBg.a < 1 ? over(ownBg, back) : ownBg;
		const hi = Math.max(lum(fg), lum(effBg));
		const lo = Math.min(lum(fg), lum(effBg));
		return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
	};
	const out = {};
	for (const [key, sel] of Object.entries(selectorMap)) {
		const el = document.querySelector(sel);
		out[key] = el ? ratio(el) : null;
	}
	return out;
}

/** Runs in the page: radius + horizontal padding for every match of a selector. */
function geometryInPage({ sel, scaleVars }) {
	const root = getComputedStyle(document.documentElement);
	const scale = scaleVars.map((v) => root.getPropertyValue(v).trim());
	return [...document.querySelectorAll(sel)].map((el, idx) => {
		const cs = getComputedStyle(el);
		return {
			idx,
			label: (el.textContent || "").trim().slice(0, 22) || `#${idx}`,
			radius: cs.borderTopLeftRadius,
			radiusInScale: scale.includes(cs.borderTopLeftRadius),
			padL: parseFloat(cs.paddingLeft) || 0,
			padR: parseFloat(cs.paddingRight) || 0,
		};
	});
}

async function main() {
	if (!(await stat(DIST).catch(() => null))) {
		console.error(
			`[contrast] No build found at ${DIST}. Run \`astro build\` (npm run build) first.`,
		);
		process.exit(2);
	}

	const { server, port } = await startServer();
	const origin = `http://127.0.0.1:${port}${BASE}`;
	const browser = await chromium.launch();
	const failures = [];
	const rows = [];
	const geomRows = [];
	const geomFailures = [];

	try {
		for (const theme of THEMES) {
			const context = await browser.newContext();
			// Set Starlight's theme before any page script runs.
			await context.addInitScript((t) => {
				try {
					localStorage.setItem("starlight-theme", t);
				} catch {}
			}, theme);
			const page = await context.newPage();

			for (const path of PAGES) {
				await page.goto(`${origin}${path}`, { waitUntil: "load" });
				const got = await page.evaluate(auditInPage, {
					...Object.fromEntries(
						Object.entries(SELECTORS).map(([k, v]) => [k, v.sel]),
					),
				});
				for (const [key, value] of Object.entries(got)) {
					if (value == null) continue; // selector absent on this page
					const min = SELECTORS[key].min;
					const ok = value >= min;
					rows.push({ theme, path, key, value, min, ok });
					if (!ok) failures.push({ theme, path, key, value, min });
				}
			}
			await context.close();
		}

		// Geometry guardrail (theme-agnostic — checked once).
		const geomContext = await browser.newContext();
		const geomPage = await geomContext.newPage();
		for (const g of GEOMETRY) {
			await geomPage.goto(`${origin}${g.path}`, { waitUntil: "load" });
			const items = await geomPage.evaluate(geometryInPage, {
				sel: g.sel,
				scaleVars: RADIUS_SCALE_VARS,
			});
			for (const it of items) {
				const padOk = !g.needPadX || (it.padL > 0 && it.padR > 0);
				const ok = it.radiusInScale && padOk;
				geomRows.push({ sel: g.sel, ...it, ok });
				if (!ok) {
					geomFailures.push({
						sel: g.sel,
						label: it.label,
						reason: !it.radiusInScale
							? `radius ${it.radius} is not in the --radius-* scale`
							: `horizontal padding ${it.padL}/${it.padR}px (needs non-zero)`,
					});
				}
			}
		}
		await geomContext.close();
	} finally {
		await browser.close();
		server.close();
	}

	// Report
	console.log("\nDocs theme contrast guardrail");
	console.log("─".repeat(72));
	for (const r of rows) {
		const mark = r.ok ? "✓" : "✗";
		console.log(
			`${mark} ${r.theme.padEnd(5)} ${r.key.padEnd(14)} ${String(r.value).padStart(6)} (min ${r.min})  ${r.path}`,
		);
	}
	console.log("─".repeat(72));

	// Geometry report
	console.log("\nControl geometry guardrail");
	console.log("─".repeat(72));
	for (const r of geomRows) {
		const mark = r.ok ? "✓" : "✗";
		console.log(
			`${mark} ${r.label.padEnd(22)} radius ${String(r.radius).padStart(5)}  pad ${r.padL}/${r.padR}px  ${r.sel}`,
		);
	}
	console.log("─".repeat(72));

	let failed = false;

	if (failures.length) {
		failed = true;
		console.error(
			`\n✗ ${failures.length} contrast failure(s) below threshold:`,
		);
		for (const f of failures) {
			console.error(
				`  - [${f.theme}] ${f.key} = ${f.value}:1 (needs ${f.min}:1) on ${f.path}`,
			);
		}
		console.error(
			"\nDrive the element from the theme tokens (--sl-color-* / --control-*) so it inherits AA contrast in both themes.",
		);
	}

	if (geomFailures.length) {
		failed = true;
		console.error(`\n✗ ${geomFailures.length} geometry failure(s):`);
		for (const f of geomFailures) {
			console.error(`  - ${f.label} (${f.sel}): ${f.reason}`);
		}
		console.error(
			"\nDrive control geometry from the tokens (--control-* / --button-* / --radius-*) so every control is sized consistently.",
		);
	}

	if (failed) process.exit(1);

	console.log(
		`\n✓ All ${rows.length} contrast checks pass AA in both themes, and all ${geomRows.length} controls use the geometry scale (radius + non-zero padding).`,
	);
}

main().catch((err) => {
	console.error("[contrast] unexpected error:", err);
	process.exit(2);
});
