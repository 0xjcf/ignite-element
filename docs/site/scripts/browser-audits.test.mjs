import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { cli, siteRoot, withSite } from "./review-fixtures.mjs";

const { JSDOM } = createRequire(import.meta.url)("jsdom");

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
		assert.notEqual(result.status, 0, result.output);
		assert.match(result.output, /Missing required audit target.*geometry/);
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
				assert.notEqual(result.status, 0, result.output);
				assert.match(result.output, /navigation|HTTP|missing|required/i);
			}));
	}
}
