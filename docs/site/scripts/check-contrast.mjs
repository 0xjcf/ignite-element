#!/usr/bin/env node

/** Rendered contrast, interaction, and responsive-layout checks.
 * Starlight owns component styling. Geometry checks retain padding and radius
 * coverage against native component dimensions instead of a custom CSS scale.
 * Run after the site build; --interactions-only isolates theme regressions.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url)); // docs/site
const DIST = join(SITE_ROOT, "dist");
const BASE = "/ignite-element"; // must match astro.config.mjs `base`

const UI = 3; // WCAG AA for UI components / large text
const TEXT = 4.5; // WCAG AA for body text

// selector -> { sel, min }. `min` is the threshold for that element class.
const SELECTORS = {
	versionPicker: { sel: ".version-select select", min: UI },
	themeToggle: { sel: "starlight-theme-select select", min: UI },
	search: { sel: "site-search button", min: UI },
	sidebar: { sel: ".sidebar-pane a", min: TEXT },
	toc: { sel: ".right-sidebar a", min: TEXT },
	pagination: { sel: ".pagination-links a span", min: TEXT },
	inlineCode: { sel: ".sl-markdown-content code:not(pre code)", min: TEXT },
	link: { sel: ".sl-markdown-content a", min: TEXT },
	versionNotice: {
		sel: 'aside[aria-label="Documentation version"] a',
		min: TEXT,
	},
	footer: { sel: 'nav[aria-label="Support links"] a', min: TEXT },
	aside: { sel: ".starlight-aside p", min: TEXT },
};

// Pages chosen to cover every selector at least once across both themes.
// The 2.x page keeps the archived (stable cyan) accent ramp under guard
// alongside the beta (green) ramp on current pages.
const PAGES = ["/", "/migration/v3/", "/2.x/getting-started/installation/"];
const THEMES = ["dark", "light"];
const SCREENSHOTS = process.env.DOCS_SCREENSHOT_DIR;

async function capture(page, name) {
	if (!SCREENSHOTS) return;
	await mkdir(SCREENSHOTS, { recursive: true });
	await page.screenshot({ path: join(SCREENSHOTS, `${name}.png`) });
}

// Native dimensions from Starlight Select/Search and Expressive Code's copy
// button. Keep checking every control; custom radii must not return silently.
const GEOMETRY = [
	{ path: "/", sel: ".version-select select", needPadX: true, radiusRem: 0 },
	{
		path: "/",
		sel: "starlight-theme-select select",
		needPadX: true,
		radiusRem: 0,
	},
	{
		path: "/",
		sel: "site-search button[data-open-modal]",
		needPadX: true,
		radiusRem: 0.5,
	},
	{
		path: "/",
		sel: "site-search button[data-close-modal]",
		needPadX: true,
		radiusRem: 0,
	},
	{
		path: "/",
		sel: ".expressive-code .copy button",
		needPadX: false,
		radiusRem: 0.2,
	},
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
	const ratio = (el, property = "color") => {
		const cs = getComputedStyle(el);
		const back = solidBg(el);
		const fg = over(parse(cs[property]), back);
		const ownBg = parse(cs.backgroundColor);
		const effBg = ownBg.a < 1 ? over(ownBg, back) : ownBg;
		const hi = Math.max(lum(fg), lum(effBg));
		const lo = Math.min(lum(fg), lum(effBg));
		return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
	};
	const out = {};
	for (const [key, sel] of Object.entries(selectorMap)) {
		const el = document.querySelector(typeof sel === "string" ? sel : sel.sel);
		out[key] = el ? ratio(el, sel.property) : null;
	}
	return out;
}

/** Runs in the page: radius + horizontal padding for every match of a selector. */
function geometryInPage({ sel, radiusRem }) {
	const root = getComputedStyle(document.documentElement);
	const expectedRadius = radiusRem * parseFloat(root.fontSize);
	return [...document.querySelectorAll(sel)].map((el, idx) => {
		const cs = getComputedStyle(el);
		return {
			idx,
			label: (el.textContent || "").trim().slice(0, 22) || `#${idx}`,
			radius: cs.borderTopLeftRadius,
			radiusMatches:
				Math.abs(parseFloat(cs.borderTopLeftRadius) - expectedRadius) < 0.01,
			expectedRadius,
			padL: parseFloat(cs.paddingLeft) || 0,
			padR: parseFloat(cs.paddingRight) || 0,
		};
	});
}

/** Check the reported regressions through real pointer and keyboard input. */
async function checkInteractions(browser, origin) {
	for (const theme of THEMES) {
		const context = await browser.newContext({
			viewport: { width: 1440, height: 960 },
			permissions: ["clipboard-read", "clipboard-write"],
		});
		await context.addInitScript(
			(value) => localStorage.setItem("starlight-theme", value),
			theme,
		);
		const page = await context.newPage();
		try {
			for (const path of ["/", "/2.x/getting-started/installation/"]) {
				await page.goto(`${origin}${path}`);
				const label = `${theme} ${path}`;
				if (path === "/") {
					const expected = await readFile(
						new URL(
							"../../../scripts/__tests__/fixtures/handbook/toggle.tsx",
							import.meta.url,
						),
						"utf8",
					);
					await page
						.getByRole("figure", { name: "src/toggle.tsx", exact: true })
						.getByRole("button", { name: "Copy to clipboard", exact: true })
						.click();
					await expect
						.poll(() => page.evaluate(() => navigator.clipboard.readText()))
						.toBe(expected.replaceAll("\t", "  ").trimEnd());
				}
				const pagination = page.locator(".pagination-links a").first();
				await pagination.scrollIntoViewIfNeeded();
				await page.mouse.move(0, 0);
				const border = {
					border: { sel: ".pagination-links a", property: "borderTopColor" },
				};
				const normal = (await page.evaluate(auditInPage, border)).border;
				await pagination.hover();
				const hover = (await page.evaluate(auditInPage, border)).border;
				assert.ok(
					hover >= UI && hover > normal,
					`${label}: pagination hover border ${hover}:1 must strengthen default ${normal}:1 and reach ${UI}:1`,
				);
				if (path === "/")
					await capture(page, `starlight-${theme}-pagination-hover`);
				await page.mouse.move(0, 0);
				console.log(
					`${label}: pagination border ${normal}:1 → ${hover}:1 on hover`,
				);
				// Tab into the link: focus must remain visible without a pointer hover.
				await pagination.focus();
				await page.keyboard.press("Shift+Tab");
				await page.keyboard.press("Tab");
				assert.ok(
					await pagination.evaluate((e) => {
						const s = getComputedStyle(e);
						return (
							e.matches(":focus-visible") &&
							s.outlineStyle !== "none" &&
							parseFloat(s.outlineWidth) > 0
						);
					}),
					`${label}: pagination keyboard focus`,
				);
				const footer = page
					.getByRole("navigation", { name: "Support links" })
					.getByRole("link")
					.first();
				const contentLink = page.locator(".sl-markdown-content a").first();
				await page.mouse.move(0, 0);
				assert.equal(
					await footer.evaluate((e) => getComputedStyle(e).color),
					await contentLink.evaluate((e) => getComputedStyle(e).color),
					`${label}: footer uses the content link theme`,
				);
				await footer.hover();
				const footerHover = await footer.evaluate(
					(e) => getComputedStyle(e).color,
				);
				await contentLink.hover();
				assert.equal(
					footerHover,
					await contentLink.evaluate((e) => getComputedStyle(e).color),
					`${label}: footer uses the content link hover theme`,
				);
			}
			await page.setViewportSize({ width: 390, height: 844 });
			for (const path of ["/", "/2.x/getting-started/installation/"]) {
				await page.goto(`${origin}${path}`);
				const menu = page.getByRole("button", { name: "Menu", exact: true });
				for (const expanded of [false, true]) {
					if (expanded) await menu.click();
					if (expanded && path === "/")
						await capture(page, `starlight-${theme}-mobile-menu`);
					const contrast = await page.evaluate(auditInPage, {
						menu: "starlight-menu-button button",
					});
					assert.ok(
						contrast.menu >= UI,
						`${theme} ${path}: ${expanded ? "expanded" : "closed"} mobile menu icon ${contrast.menu}:1`,
					);
				}
				await menu.press("Escape");
				await expect(page.locator("starlight-menu-button")).toHaveAttribute(
					"aria-expanded",
					"false",
				);
			}
		} finally {
			await context.close();
		}
	}
	console.log(
		"Shared interactions: beta/archive in both themes; pagination hover/focus, footer link states, and mobile menu open/close passed.",
	);
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
		await checkInteractions(browser, origin);
		if (process.argv.includes("--interactions-only")) return;
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

		// Shared layout: the divider must be the actual rail boundary, and tables
		// must remain reachable without scrolling the document at narrow widths.
		for (const theme of THEMES) {
			const context = await browser.newContext();
			await context.addInitScript(
				(value) => localStorage.setItem("starlight-theme", value),
				theme,
			);
			const page = await context.newPage();
			for (const width of [1280, 1440, 1920, 768, 390]) {
				await page.setViewportSize({ width, height: 960 });
				for (const path of [
					"/",
					"/handbook/examples/",
					"/handbook/api/",
					"/guides/routing/",
					"/2.x/api/ignite-core/",
				]) {
					await page.goto(`${origin}${path}`);
					const layout = await page.evaluate(() => {
						const rail = document.querySelector(".right-sidebar");
						const divider =
							document.querySelector(".header-preferences") ||
							document.querySelector(".social-icons");
						const selects = [...document.querySelectorAll("header select")];
						return {
							overflow: document.documentElement.scrollWidth - innerWidth,
							rail: rail?.getBoundingClientRect().left,
							divider:
								divider?.getBoundingClientRect()[
									divider.classList.contains("header-preferences")
										? "left"
										: "right"
								],
							titleFits: (() => {
								const title = document.querySelector(".site-title span");
								return title.scrollWidth <= title.clientWidth + 1;
							})(),
							selects: selects.map((e) => ({
								appearance: getComputedStyle(e).appearance,
								height: e.getBoundingClientRect().height,
							})),
							tables: [
								...document.querySelectorAll(".sl-markdown-content table"),
							].map((table) => {
								const frame = table.closest(".table-scroll");
								return {
									grid: table.tBodies[0]?.getBoundingClientRect().width,
									width: table.getBoundingClientRect().width,
									scrollable:
										frame && getComputedStyle(frame).overflowX === "auto",
									focusable: frame?.tabIndex === 0,
								};
							}),
						};
					});
					const label = `${theme} ${width}px ${path}`;
					if ([1440, 390].includes(width)) {
						const name =
							path === "/"
								? "getting-started"
								: path.split("/").filter(Boolean).join("-");
						await capture(page, `starlight-${theme}-${width}-${name}`);
					}
					assert.ok(
						layout.overflow <= 1,
						`${label}: document overflow ${layout.overflow}px`,
					);
					if (width >= 1152) {
						assert.ok(layout.titleFits, `${label}: clipped site title`);
						assert.ok(
							Math.abs(layout.rail - layout.divider) <= 1,
							`${label}: divider ${layout.divider} != rail ${layout.rail}`,
						);
						assert.equal(
							layout.selects[0].appearance,
							layout.selects[1].appearance,
							label,
						);
						assert.equal(
							layout.selects[0].height,
							layout.selects[1].height,
							label,
						);
					}
					for (const table of layout.tables) {
						assert.ok(
							Math.abs(table.width - table.grid) <= 2,
							`${label}: empty strip inside table frame`,
						);
						assert.ok(
							table.scrollable && table.focusable,
							`${label}: table must support local keyboard scrolling`,
						);
					}
					for (const frame of await page
						.locator(".table-scroll, .expressive-code pre")
						.all()) {
						if (await frame.evaluate((e) => e.scrollWidth > e.clientWidth)) {
							// Expressive Code assigns focusability after its resize observer runs.
							await expect(frame).toHaveAttribute("tabindex", "0");
							assert.ok(
								await frame.evaluate(
									(e) =>
										e.tabIndex >= 0 &&
										["auto", "scroll"].includes(getComputedStyle(e).overflowX),
								),
								`${label}: wide content must allow keyboard scrolling`,
							);
							await frame.focus();
							await page.keyboard.press("ArrowRight");
							await page.waitForFunction(
								() => document.activeElement.scrollLeft > 0,
							);
						}
					}
				}
			}
			await context.close();
		}
		console.log(
			"Shared layout: 50 page/theme/viewport cases; table grids and table/code keyboard scrolling passed.",
		);

		// Geometry guardrail (theme-agnostic — checked once).
		const geomContext = await browser.newContext();
		const geomPage = await geomContext.newPage();
		for (const g of GEOMETRY) {
			await geomPage.goto(`${origin}${g.path}`, { waitUntil: "load" });
			const items = await geomPage.evaluate(geometryInPage, {
				sel: g.sel,
				radiusRem: g.radiusRem,
			});
			assert.ok(items.length > 0, `Missing geometry target: ${g.sel}`);
			for (const it of items) {
				const padOk = !g.needPadX || (it.padL > 0 && it.padR > 0);
				const ok = it.radiusMatches && padOk;
				geomRows.push({ sel: g.sel, ...it, ok });
				if (!ok) {
					geomFailures.push({
						sel: g.sel,
						label: it.label,
						reason: !it.radiusMatches
							? `radius ${it.radius} differs from the native ${it.expectedRadius}px`
							: `horizontal padding ${it.padL}/${it.padR}px (needs non-zero)`,
					});
				}
			}
		}
		await geomContext.close();

		// Starlight renders separate desktop and mobile control instances.
		for (const width of [1366, 390]) {
			const context = await browser.newContext({
				viewport: { width, height: 900 },
			});
			const page = await context.newPage();
			await page.goto(`${origin}/contributing/shared-controller-validation/`);
			if (width < 800)
				await page.getByRole("button", { name: "Menu", exact: true }).click();
			await page
				.getByRole("combobox", { name: "Select version", exact: true })
				.selectOption({ label: "2.x" });
			await page.waitForURL(`${origin}/2.x/`);
			assert.equal(await page.locator("h1").innerText(), "Ignite Element");
			if (width < 800)
				await page.getByRole("button", { name: "Menu", exact: true }).click();
			await page
				.getByRole("combobox", { name: "Select version", exact: true })
				.selectOption({ label: "v3 (beta)" });
			await page.waitForURL(`${origin}/`);
			assert.equal(await page.locator("h1").innerText(), "Getting started");
			await page.goBack();
			await page.waitForURL(`${origin}/2.x/`);
			if (width < 800)
				await page.getByRole("button", { name: "Menu", exact: true }).click();
			const version = page.getByRole("combobox", {
				name: "Select version",
				exact: true,
			});
			assert.equal(await version.inputValue(), `${BASE}/2.x/`);
			await version.focus();
			await page.keyboard.press("Tab");
			const theme = page.getByRole("combobox", {
				name: "Select theme",
				exact: true,
			});
			assert.ok(
				await theme.evaluate((e) => e === document.activeElement),
				"Tab moves from version to theme",
			);
			assert.ok(
				await theme.evaluate((e) => {
					const style = getComputedStyle(e);
					return (
						e.matches(":focus-visible") &&
						style.outlineStyle !== "none" &&
						parseFloat(style.outlineWidth) > 0
					);
				}),
				"visible native select focus ring",
			);
			await page.keyboard.press("d");
			await page.keyboard.press("Enter");
			assert.equal(await theme.inputValue(), "dark", "keyboard selects Dark");

			for (const [fragment, title] of [
				["one-counter-two-meanings", "One counter, two meanings"],
				["delivery-and-ownership", "Delivery and ownership"],
				["migration-from-per-view-effects", "Migration from per-view effects"],
				[
					"one-production-rule-per-public-event",
					"One production rule per public event",
				],
			]) {
				await page.goto(`${origin}/guides/events/#${fragment}`);
				await page.waitForURL(`${origin}/handbook/events/#${fragment}`);
				assert.equal(await page.locator(`#${fragment}`).innerText(), title);
			}
			await context.close();
		}
		console.log(
			"Desktop/mobile version round trips, browser Back, keyboard selectors and four preserved Events subjects passed.",
		);
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
			"\nCheck the element against Starlight theme tokens and its rendered background.",
		);
	}

	if (geomFailures.length) {
		failed = true;
		console.error(`\n✗ ${geomFailures.length} geometry failure(s):`);
		for (const f of geomFailures) {
			console.error(`  - ${f.label} (${f.sel}): ${f.reason}`);
		}
		console.error(
			"\nPreserve native Starlight/Expressive Code geometry and usable control padding.",
		);
	}

	if (failed) process.exit(1);

	console.log(
		`\n✓ All ${rows.length} contrast checks pass AA in both themes, and all ${geomRows.length} controls retain native geometry (radius + non-zero padding).`,
	);
}

main().catch((err) => {
	console.error("[contrast] unexpected error:", err);
	process.exit(2);
});
