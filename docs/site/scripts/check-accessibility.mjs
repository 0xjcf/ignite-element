#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { navigateForAudit, requireAuditTargets } from "./audit-contract.mjs";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(SITE_ROOT, "dist");
const BASE = "/ignite-element";
const THEMES = ["light", "dark"];
const PAGES = [
	"/",
	"/getting-started/installation/",
	"/api/ignite-core/",
	"/api/headless-runtime/",
	"/2.x/",
	"/2.x/getting-started/installation/",
];

const MIME = {
	".css": "text/css",
	".html": "text/html",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

function startServer() {
	const server = createServer(async (req, res) => {
		try {
			let path = decodeURIComponent((req.url || "/").split("?")[0]);
			if (path.startsWith(BASE)) path = path.slice(BASE.length);
			if (!path || path === "/") path = "/index.html";
			let file = normalize(join(DIST, path));
			if (!file.startsWith(DIST)) return res.writeHead(403).end("forbidden");
			let info = await stat(file).catch(() => null);
			if (info?.isDirectory()) file = join(file, "index.html");
			else if (!info && !extname(file)) file = join(file, "index.html");
			info = await stat(file).catch(() => null);
			if (!info) return res.writeHead(404).end("not found");
			res.writeHead(200, {
				"content-type": MIME[extname(file)] || "application/octet-stream",
			});
			res.end(await readFile(file));
		} catch {
			res.writeHead(500).end("error");
		}
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () =>
			resolve({ server, port: server.address().port }),
		);
	});
}

async function main() {
	if (!(await stat(DIST).catch(() => null))) {
		console.error("[accessibility] Build docs/site before running this check.");
		process.exit(2);
	}

	const { server, port } = await startServer();
	const browser = await chromium.launch();
	const failures = [];
	try {
		for (const theme of THEMES) {
			const context = await browser.newContext();
			await context.addInitScript((value) => {
				localStorage.setItem("starlight-theme", value);
			}, theme);
			const page = await context.newPage();
			for (const path of PAGES) {
				await navigateForAudit(page, `http://127.0.0.1:${port}${BASE}${path}`, {
					waitUntil: "networkidle",
				});
				await requireAuditTargets(
					page,
					[
						"main h1",
						"starlight-version-select select",
						"site-search button[data-open-modal]",
					],
					`${theme} ${path}`,
				);
				const result = await new AxeBuilder({ page }).analyze();
				console.log(
					`${result.violations.length ? "✗" : "✓"} ${theme.padEnd(5)} ${path}`,
				);
				for (const violation of result.violations) {
					failures.push({ theme, path, violation });
				}
			}
			await context.close();
		}
	} finally {
		await browser.close();
		server.close();
	}

	for (const { theme, path, violation } of failures) {
		console.error(
			`[${theme}] ${path} ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`,
		);
		for (const node of violation.nodes) {
			console.error(`  ${node.target.join(" ")} — ${node.failureSummary}`);
		}
	}
	if (failures.length) process.exit(1);
	console.log(
		`\n✓ ${THEMES.length * PAGES.length} rendered page/theme combinations have no axe violations.`,
	);
}

main().catch((error) => {
	console.error("[accessibility] unexpected error:", error);
	process.exit(2);
});
