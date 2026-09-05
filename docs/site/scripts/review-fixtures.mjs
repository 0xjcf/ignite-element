import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const siteRoot = fileURLToPath(new URL("../", import.meta.url));
export function withSite(run) {
	const root = fs.realpathSync(
		fs.mkdtempSync(path.join(os.tmpdir(), "ignite-docs-regression-")),
	);
	const site = path.join(root, "docs/site");
	fs.mkdirSync(site, { recursive: true });
	fs.symlinkSync(
		path.resolve(siteRoot, "../../node_modules"),
		path.join(root, "node_modules"),
	);
	for (const name of ["scripts", "src", "astro.config.mjs", "package.json"]) {
		fs.cpSync(path.join(siteRoot, name), path.join(site, name), {
			recursive: true,
		});
	}
	fs.mkdirSync(path.join(site, "node_modules"), { recursive: true });
	for (const name of fs.readdirSync(path.join(siteRoot, "node_modules"))) {
		fs.symlinkSync(
			path.join(siteRoot, "node_modules", name),
			path.join(site, "node_modules", name),
		);
	}
	fs.cpSync(
		path.resolve(siteRoot, "../../.github"),
		path.join(root, ".github"),
		{ recursive: true },
	);
	fs.copyFileSync(
		path.resolve(siteRoot, "../../package.json"),
		path.join(root, "package.json"),
	);
	try {
		return run({ root, site });
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}
export function cli(site, name) {
	const result = spawnSync(
		process.execPath,
		[path.join(site, "scripts", name)],
		{
			cwd: site,
			encoding: "utf8",
			timeout: 60000,
		},
	);
	if (result.error) throw result.error;
	return { status: result.status, output: result.stdout + result.stderr };
}
