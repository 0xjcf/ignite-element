#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(SITE_ROOT, "dist");
const BASE = "/ignite-element/";
const CANONICAL_ORIGIN = "https://0xjcf.github.io";
const CHECK_EXTERNAL = process.argv.includes("--external");
const EXTERNAL_TIMEOUT_MS = 20_000;

async function walk(dir) {
	const files = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(path)));
		else files.push(path);
	}
	return files;
}

function documentUrl(file) {
	let path = relative(DIST, file).split(sep).join("/");
	if (path === "index.html") path = "";
	else if (path.endsWith("/index.html")) path = path.slice(0, -10);
	return new URL(`${BASE}${path}`, CANONICAL_ORIGIN);
}

function localFile(url) {
	let path = decodeURIComponent(url.pathname);
	if (!path.startsWith(BASE)) return null;
	path = path.slice(BASE.length);
	if (path === "404/") path = "404.html";
	if (!path || path.endsWith("/")) path += "index.html";
	const direct = resolve(DIST, path);
	if (!direct.startsWith(`${DIST}${sep}`) && direct !== DIST) return null;
	return direct;
}

function references(text, extension) {
	const found = [];
	if (extension === ".html") {
		for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
			found.push(match[1]);
		}
	}
	if (extension === ".css") {
		for (const match of text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) {
			found.push(match[1]);
		}
	}
	if (extension === ".txt") {
		for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
			found.push(match[1]);
	}
	return found;
}

function ids(text) {
	return new Set(
		[...text.matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)].map((match) =>
			decodeURIComponent(match[1]),
		),
	);
}

async function validateExternal(url) {
	const options = {
		headers: { "user-agent": "ignite-element-docs-link-check/1.0" },
		redirect: "follow",
		signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
	};
	let response = await fetch(url, { ...options, method: "HEAD" });
	if (response.status === 405 || response.status === 501) {
		response = await fetch(url, { ...options, method: "GET" });
	}
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function main() {
	if (!(await stat(DIST).catch(() => null))) {
		console.error("[links] Build docs/site before running this check.");
		process.exit(2);
	}

	const files = await walk(DIST);
	const html = new Map();
	for (const file of files.filter((path) => extname(path) === ".html")) {
		html.set(file, await readFile(file, "utf8"));
	}
	const external = new Set();
	const failures = [];
	let checked = 0;

	for (const file of files) {
		const extension = extname(file);
		if (![".html", ".css", ".txt"].includes(extension)) continue;
		const text = html.get(file) ?? (await readFile(file, "utf8"));
		const base =
			extension === ".html"
				? documentUrl(file)
				: new URL(
						`${BASE}${relative(DIST, file).split(sep).join("/")}`,
						CANONICAL_ORIGIN,
					);
		for (const raw of references(text, extension)) {
			if (/^(?:data|mailto|tel|javascript):/i.test(raw)) continue;
			let url;
			try {
				url = new URL(raw, base);
			} catch {
				failures.push(`${relative(DIST, file)}: invalid URL ${raw}`);
				continue;
			}
			if (url.origin !== CANONICAL_ORIGIN) {
				if (url.protocol === "http:" || url.protocol === "https:")
					external.add(url.href);
				continue;
			}
			checked += 1;
			const target = localFile(url);
			const info = target ? await stat(target).catch(() => null) : null;
			if (!info?.isFile()) {
				failures.push(`${relative(DIST, file)}: missing ${url.pathname}`);
				continue;
			}
			if (url.hash && extname(target) === ".html") {
				const anchor = decodeURIComponent(url.hash.slice(1));
				const targetText = html.get(target) ?? (await readFile(target, "utf8"));
				if (!ids(targetText).has(anchor)) {
					failures.push(
						`${relative(DIST, file)}: missing anchor ${url.pathname}${url.hash}`,
					);
				}
			}
		}
	}

	if (CHECK_EXTERNAL) {
		for (const url of [...external].sort()) {
			try {
				await validateExternal(url);
			} catch (error) {
				failures.push(`external ${url}: ${error.message}`);
			}
		}
	}

	for (const failure of failures) console.error(`✗ ${failure}`);
	if (failures.length) process.exit(1);
	console.log(
		`✓ ${checked} internal references and ${CHECK_EXTERNAL ? external.size : 0} external URLs resolve; ${html.size} HTML documents checked.`,
	);
}

main().catch((error) => {
	console.error("[links] unexpected error:", error);
	process.exit(2);
});
