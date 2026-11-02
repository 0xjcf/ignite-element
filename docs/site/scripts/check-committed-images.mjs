#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const roots = ["public", "src/assets", "src/content"].map((dir) =>
	join(siteRoot, dir),
);
const rasterExtensions = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".avif",
	".tif",
	".tiff",
]);

async function walk(dir) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (error) {
		if (error && error.code === "ENOENT") return [];
		throw error;
	}
	const files = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(path)));
		} else if (rasterExtensions.has(extname(entry.name).toLowerCase())) {
			files.push(path);
		}
	}
	return files;
}

const failures = [];
for (const root of roots) {
	for (const file of await walk(root)) {
		try {
			const input = await readFile(file);
			await sharp(input, { failOn: "error" }).rotate().toBuffer();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${relative(siteRoot, file)}: ${message}`);
		}
	}
}

if (failures.length > 0) {
	console.error("Committed docs images failed to decode:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}
