import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(siteRoot, "../..");
const script = path.join(siteRoot, "scripts/check-committed-images.mjs");
const corruptFixture = path.join(
	siteRoot,
	"scripts/fixtures/committed-images/corrupt-header.jpeg",
);
const missingEndFixture = path.join(
	siteRoot,
	"scripts/fixtures/committed-images/missing-iend.png",
);

function runCheck() {
	const result = spawnSync(process.execPath, [script], {
		cwd: siteRoot,
		encoding: "utf8",
	});
	if (result.error) throw result.error;
	return {
		status: result.status,
		output: `${result.stdout}${result.stderr}`,
	};
}

function withCopy(source, destination, run) {
	fs.copyFileSync(source, destination);
	try {
		return run();
	} finally {
		fs.rmSync(destination, { force: true });
	}
}

test("committed image hardening", { concurrency: false }, async (t) => {
	await t.test("corrupt image under src/components fails the check", () => {
		const destination = path.join(
			siteRoot,
			"src/components/corrupt-header.jpeg",
		);
		assert.ok(fs.existsSync(corruptFixture));
		withCopy(corruptFixture, destination, () => {
			const result = runCheck();
			assert.notEqual(result.status, 0, result.output);
			assert.match(
				result.output,
				/src[/\\]components[/\\]corrupt-header\.jpeg/,
			);
		});
	});

	await t.test("png missing its end chunk fails the check", () => {
		const destination = path.join(siteRoot, "src/assets/missing-iend.png");
		assert.ok(fs.existsSync(missingEndFixture));
		withCopy(missingEndFixture, destination, () => {
			const result = runCheck();
			assert.notEqual(result.status, 0, result.output);
			assert.match(result.output, /missing-iend\.png/);
		});
		const source = fs.readFileSync(script, "utf8");
		assert.match(source, /failOn:\s*"warning"/);
	});

	await t.test(
		"truncated png imported through Image from the old exempt path fails the check",
		() => {
			const png = path.join(
				siteRoot,
				"src/components/fixtures/missing-iend.png",
			);
			const page = path.join(siteRoot, "src/pages/truncated-image-probe.astro");
			const markup = `---
import { Image } from "astro:assets";
import truncated from "../components/fixtures/missing-iend.png";
---
<Image src={truncated} alt="Truncated fixture" />
`;
			fs.mkdirSync(path.dirname(png), { recursive: true });
			fs.copyFileSync(missingEndFixture, png);
			fs.mkdirSync(path.dirname(page), { recursive: true });
			fs.writeFileSync(page, markup);
			try {
				assert.match(
					fs.readFileSync(page, "utf8"),
					/import \{ Image \} from "astro:assets"/,
				);
				assert.match(fs.readFileSync(page, "utf8"), /<Image\s/);
				const result = runCheck();
				assert.notEqual(result.status, 0, result.output);
				assert.match(
					result.output,
					/src[/\\]components[/\\]fixtures[/\\]missing-iend\.png/,
				);
			} finally {
				fs.rmSync(page, { force: true });
				fs.rmSync(png, { force: true });
				fs.rmdirSync(path.dirname(page));
				fs.rmdirSync(path.dirname(png));
			}
		},
	);

	await t.test("docs and CI builds cannot skip the image check", () => {
		const pkg = JSON.parse(
			fs.readFileSync(path.join(siteRoot, "package.json"), "utf8"),
		);
		const buildScripts = Object.entries(pkg.scripts).filter(([, command]) =>
			command.includes("astro build"),
		);
		assert.ok(buildScripts.length > 0);
		for (const [name, command] of buildScripts) {
			assert.match(command, /check-committed-images\.mjs/, name);
		}
		const config = fs.readFileSync(
			path.join(siteRoot, "astro.config.mjs"),
			"utf8",
		);
		assert.match(config, /check-committed-images/);
		const contrast = fs.readFileSync(
			path.join(siteRoot, "scripts/check-contrast.mjs"),
			"utf8",
		);
		assert.doesNotMatch(contrast, /Run `astro build`/);
		for (const workflow of ["docs-contrast.yml", "docs-deploy.yml"]) {
			const text = fs.readFileSync(
				path.join(repoRoot, ".github/workflows", workflow),
				"utf8",
			);
			assert.match(text, /pnpm --filter docs-site build/);
			assert.doesNotMatch(text, /\bastro build\b/);
		}
		const rootPkg = JSON.parse(
			fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
		);
		assert.equal(
			rootPkg.scripts["docs:build"],
			"pnpm --filter docs-site build",
		);
	});
});
