import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { cli, siteRoot, withSite } from "./review-fixtures.mjs";

const { JSDOM } = createRequire(import.meta.url)("jsdom");

function assertAuditFailure(result, script, scenario) {
	assert.equal(
		result.error,
		undefined,
		"audit subprocess must not time out or fail to spawn",
	);
	assert.ok(!result.signal, "audit subprocess must not exit via a signal");
	assert.equal(result.status, 2, result.output);
	const audit = script === "check-contrast.mjs" ? "contrast" : "accessibility";
	const prefix = `[${audit}] unexpected error: Error: `;
	const lines = result.output.trim().split(/\r?\n/);
	assert.ok(lines[0].startsWith(prefix), result.output);
	const diagnostic = lines[0].slice(prefix.length);
	if (scenario === "missing-route") {
		const route =
			audit === "contrast"
				? "/ignite-element/getting-started/installation/"
				: "/ignite-element/";
		const match =
			/^Audit navigation failed: HTTP 404 for (http:\/\/127\.0\.0\.1:\d+\/[^\s]*)$/.exec(
				diagnostic,
			);
		assert.ok(match, result.output);
		assert.equal(new URL(match[1]).pathname, route);
		assert.ok(
			lines[1]?.trim().startsWith("at navigateForAudit ("),
			result.output,
		);
	} else {
		const target =
			scenario === "geometry"
				? ".hero .actions a (geometry /)"
				: `starlight-version-select select (${audit === "contrast" ? "dark /getting-started/installation/" : "light /"})`;
		assert.equal(diagnostic, `Missing required audit target ${target}`);
		assert.ok(
			lines[1]?.trim().startsWith("at requireAuditTargets ("),
			result.output,
		);
	}
}

test("contrast CLI rejects missing required geometry in the built homepage", () =>
	withSite(({ site }) => {
		fs.cpSync(path.join(siteRoot, "dist"), path.join(site, "dist"), {
			recursive: true,
		});
		const file = path.join(site, "dist/index.html");
		const dom = new JSDOM(fs.readFileSync(file, "utf8"));
		try {
			const links = dom.window.document.querySelectorAll(".hero .actions a");
			assert.ok(links.length > 0, "The baseline must contain hero controls");
			for (const link of links) link.remove();
			fs.writeFileSync(file, dom.serialize());
		} finally {
			dom.window.close();
		}
		const result = cli(site, "check-contrast.mjs");
		assertAuditFailure(result, "check-contrast.mjs", "geometry");
	}));
for (const script of ["check-accessibility.mjs", "check-contrast.mjs"]) {
	for (const scenario of ["missing-route", "missing-elements"]) {
		test(`${script} fails closed for ${scenario}`, () =>
			withSite(({ site }) => {
				fs.mkdirSync(path.join(site, "dist"), { recursive: true });
				if (scenario === "missing-elements") {
					for (const route of [
						"",
						"getting-started/installation",
						"api/ignite-core",
						"api/headless-runtime",
						"migration/v3",
						"2.x",
						"2.x/getting-started/installation",
					]) {
						const dir = path.join(site, "dist", route);
						fs.mkdirSync(dir, { recursive: true });
						fs.writeFileSync(
							path.join(dir, "index.html"),
							'<html lang="en"><head><title>Empty audit fixture</title></head><body><main><h1>Not the expected documentation</h1></main></body></html>',
						);
					}
				}
				const result = cli(site, script);
				assertAuditFailure(result, script, scenario);
			}));
	}
}

const scenarios = [
	["check-contrast.mjs", "geometry"],
	...["check-accessibility.mjs", "check-contrast.mjs"].flatMap((script) =>
		["missing-route", "missing-elements"].map((scenario) => [script, scenario]),
	),
];
for (const [script, scenario] of scenarios) {
	for (const [failure, result] of [
		[
			"missing executable",
			{
				status: 2,
				output:
					"[contrast] unexpected error: browserType.launch: Executable doesn't exist at /missing/http/example\n",
			},
		],
		[
			"startup failure",
			{
				status: 2,
				output:
					"[contrast] unexpected error: browserType.launch: Target closed at http://missing.invalid/\n",
			},
		],
		[
			"module load failure",
			{
				status: 1,
				output:
					"Error [ERR_MODULE_NOT_FOUND]: Cannot find module /missing/required.mjs imported from http://example.invalid/\n",
			},
		],
		[
			"unexpected exception",
			{
				status: 2,
				output: `[${script === "check-contrast.mjs" ? "contrast" : "accessibility"}] unexpected error: Error: missing HTTP resource\n`,
			},
		],
		[
			"signal",
			{
				status: null,
				signal: "SIGTERM",
				output:
					"Audit navigation failed: HTTP 404 for http://127.0.0.1:1234/ignite-element/",
			},
		],
		[
			"timeout",
			{
				status: null,
				error: { code: "ETIMEDOUT" },
				output: "Missing required audit target (geometry /)",
			},
		],
		["success", { status: 0, output: "missing required HTTP navigation" }],
		[
			"ordinary audit violation",
			{ status: 1, output: "Missing required audit target (geometry /)" },
		],
	]) {
		test(`infrastructure control rejects ${failure} for ${script} ${scenario}`, () => {
			assert.throws(() => assertAuditFailure(result, script, scenario));
		});
	}
}
for (const script of ["check-accessibility.mjs", "check-contrast.mjs"]) {
	test(`infrastructure control rejects real missing Chromium for ${script}`, () =>
		withSite(({ root, site }) => {
			fs.mkdirSync(path.join(site, "dist"));
			const result = spawnSync(
				process.execPath,
				[path.join(site, "scripts", script)],
				{
					cwd: site,
					encoding: "utf8",
					timeout: 10000,
					env: {
						...process.env,
						PLAYWRIGHT_BROWSERS_PATH: path.join(root, "missing-chromium"),
					},
				},
			);
			const observed = { ...result, output: result.stdout + result.stderr };
			assert.equal(result.error, undefined);
			assert.equal(result.status, 2, observed.output);
			assert.match(
				observed.output,
				/browserType\.launch: Executable doesn't exist at .*missing-chromium/,
			);
			for (const scenario of ["missing-route", "missing-elements"]) {
				assert.throws(() => assertAuditFailure(observed, script, scenario));
			}
			if (script === "check-contrast.mjs")
				assert.throws(() => assertAuditFailure(observed, script, "geometry"));
		}));
}
