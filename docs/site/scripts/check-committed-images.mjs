#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const siteRoot = fileURLToPath(new URL("..", import.meta.url));
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
const pngSignature = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngMissingEndChunk(buffer) {
	if (buffer.length < 8 || !buffer.subarray(0, 8).equals(pngSignature)) {
		return false;
	}
	let offset = 8;
	while (offset + 12 <= buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
		const next = offset + 12 + length;
		if (next > buffer.length) return true;
		offset = next;
		if (type === "IEND") return offset !== buffer.length;
	}
	return true;
}

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

export async function checkCommittedImages(root = siteRoot) {
	const failures = [];
	for (const dir of ["public", "src"]) {
		for (const file of await walk(join(root, dir))) {
			const input = await readFile(file);
			const relativePath = relative(root, file);
			// libvips 8.18 does not call png_read_end(), so failOn "warning"
			// still decodes a PNG whose IEND chunk is absent.
			if (extname(file).toLowerCase() === ".png" && pngMissingEndChunk(input)) {
				failures.push(`${relativePath}: PNG is missing its IEND chunk`);
				continue;
			}
			try {
				await sharp(input, { failOn: "warning" }).rotate().toBuffer();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failures.push(`${relativePath}: ${message}`);
			}
		}
	}
	return failures;
}

const isCli =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
	const failures = await checkCommittedImages();
	if (failures.length > 0) {
		console.error("Committed docs images failed to decode:");
		for (const failure of failures) console.error(`- ${failure}`);
		process.exit(1);
	}
}
