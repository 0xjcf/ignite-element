import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installation = "src/content/docs/index.mdx";
const historicalInstallation = "src/content/docs/api/compatibility.mdx";

function checkFixture(mutate = () => {}) {
	const directory = fs.mkdtempSync(
		path.join(os.tmpdir(), "ignite-doc-versions-"),
	);
	try {
		for (const entry of [
			"src",
			"astro.config.mjs",
			"public/ignite-element-favicon-stable.svg",
			"scripts/check-version-routing.mjs",
		]) {
			const destination = path.join(directory, entry);
			fs.mkdirSync(path.dirname(destination), { recursive: true });
			fs.cpSync(path.join(site, entry), destination, { recursive: true });
		}
		const replace = (file, from, to) => {
			const target = path.join(directory, file);
			const before = fs.readFileSync(target, "utf8");
			const after = before.replace(from, to);
			assert.notEqual(after, before, `fixture mutation must apply: ${file}`);
			fs.writeFileSync(target, after);
		};
		const append = (file, text) =>
			fs.appendFileSync(path.join(directory, file), `\n${text}\n`);
		mutate({ replace, append });
		const result = spawnSync(
			process.execPath,
			[path.join(directory, "scripts/check-version-routing.mjs")],
			{
				cwd: directory,
				encoding: "utf8",
				env: { PATH: process.env.PATH },
			},
		);
		assert.ifError(result.error);
		return { status: result.status, output: result.stdout + result.stderr };
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
}

function passes(mutate) {
	const result = checkFixture(mutate);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /verified-version-routing-contract/);
}

function rejects(mutate, reason) {
	const result = checkFixture(mutate);
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, reason);
}

test("publication copy and historical beta.14 pages pass together", () =>
	passes());

test("verified beta.14 publication and exact installation are permitted", () =>
	passes(({ append }) =>
		append(
			historicalInstallation,
			"3.0.0-beta.14 is published. Install with `pnpm add ignite-element@3.0.0-beta.14`.",
		),
	));

test("current headless guidance defines core-owned effect timing", () => {
	const content = fs.readFileSync(
		path.join(site, "src/content/docs/api/headless-runtime.mdx"),
		"utf8",
	);
	assert.doesNotMatch(content, /Since beta\.|required in beta\./);
	assert.match(content, /one\s+evaluator per core\/source instance/);
	assert.match(content, /not a renderer or\s+framework commit barrier/);
	assert.doesNotMatch(content, /retain Ignite-renderer\s+post-render timing/);
});

test("canonical event guidance separates native and derived producers", () => {
	const content = fs.readFileSync(
		path.join(site, "src/content/docs/handbook/events.mdx"),
		"utf8",
	);
	assert.match(content, /Do not mirror native occurrences in effects/);
	assert.match(content, /Headless listeners may infer native/);
	assert.match(content, /DOM forwarding and React web callbacks/);
});

test("current lifetime guides retain the published registered-disposal contract", () => {
	for (const file of [
		"handbook/ownership.mdx",
		"handbook/testing.mdx",
		"guides/actor-web.mdx",
	]) {
		const content = fs.readFileSync(
			path.join(site, "src/content/docs", file),
			"utf8",
		);
		assert.match(
			content,
			/dispos(?:al|e(?:\(\))?).{0,100}registered|registered.{0,100}dispos(?:al|e(?:\(\))?)/is,
			file,
		);
		assert.doesNotMatch(
			content,
			/[Ss]uccessful registration (?:still )?prevents owning(?:-core)? disposal|registered cores reject owning disposal/,
			file,
		);
	}
	const migration = fs.readFileSync(
		path.join(site, "src/content/docs/migration/v3.mdx"),
		"utf8",
	);
	assert.doesNotMatch(
		migration,
		/Keep session cores unregistered/,
		"registration is not a disposal prohibition",
	);
});

for (const selector of [
	"beta",
	"3.0.0-beta.14",
	"3.0.0-beta.13",
	"3.0.0-beta.12",
	"3.0.0-beta.11",
]) {
	test(`complete supported install selector ${selector} passes`, () =>
		passes(({ append }) => {
			append(
				"src/content/docs/api/compatibility.mdx",
				`Verified public 3.0.0-beta.14; historical releases 3.0.0-beta.13, 3.0.0-beta.12 and 3.0.0-beta.11.\n\n\`npm install --save react "ignite-element@${selector}"\``,
			);
		}));
}

for (const selector of [
	"beta.12",
	"3.0.0-beta.15",
	"3.0.0-beta.120",
	"3.0.0-beta.12-extra",
	"3.0.0-beta.11-extra",
	"3.0.0-rc.1",
	"3.0.0",
	"latest",
	"",
	"^3.0.0-beta.12",
]) {
	test(`unsupported complete selector ${selector || "unqualified"} fails`, () =>
		rejects(({ append }) => {
			append(
				historicalInstallation,
				`\`npm install --save react ignite-element${selector ? `@${selector}` : ""}\``,
			);
		}, /unsupported v3 install/));
}

test("an empty version selector fails visibly", () =>
	rejects(
		({ append }) =>
			append(historicalInstallation, "`pnpm add ignite-element@`"),
		/unsupported v3 install/,
	));
for (const quote of ['"', "'"]) {
	for (const suffix of [
		";invalid",
		"|invalid",
		"&invalid",
		"#invalid",
		",invalid",
		")invalid",
		" invalid",
	]) {
		test(`quoted selector ${quote}beta${suffix}${quote} fails completely`, () =>
			rejects(
				({ append }) =>
					append(
						historicalInstallation,
						`\`npm install ${quote}ignite-element@beta${suffix}${quote}\``,
					),
				/unsupported v3 install/,
			));
	}
}
test("shell separators outside quoted selectors remain valid", () =>
	passes(({ append }) =>
		append(
			historicalInstallation,
			'`npm install "ignite-element@beta"; echo done`',
		),
	));
test("concatenated quoted selector suffix is not discarded", () =>
	rejects(
		({ append }) =>
			append(
				historicalInstallation,
				'`npm install "ignite-element@beta"invalid`',
			),
		/unsupported v3 install/,
	));
test("an allowed selector elsewhere cannot hide an unsupported selector", () =>
	rejects(
		({ append }) =>
			append(
				historicalInstallation,
				"`pnpm add ignite-element@beta ignite-element@3.0.0-beta.121`",
			),
		/unsupported v3 install/,
	));
test("stable facade policy drift fails", () =>
	rejects(
		({ replace }) =>
			replace(
				installation,
				/ignite-element@latest[^\n]*2\.2\.2/,
				"ignite-element@latest = 3.0.0-beta.12",
			),
		/stable facade policy/,
	));
test("stable v3 installation claim fails", () =>
	rejects(
		({ append }) => append(installation, "This is stable v3."),
		/must not be described as stable/,
	));
test("persistent stable-v3 label fails", () =>
	rejects(
		({ replace }) =>
			replace("astro.config.mjs", 'label: "v3 (beta)"', 'label: "v3 (stable)"'),
		/current docs must be labeled v3 \(beta\)/,
	));
test("v2 installation cannot select beta", () =>
	rejects(
		({ replace }) =>
			replace(
				"src/content/docs/2.x/getting-started/installation.mdx",
				/ignite-element@2\.2\.2/g,
				"ignite-element@beta",
			),
		/v2 install must not select beta packages/,
	));
test("v2 archive cannot mention published beta.12", () =>
	rejects(
		({ append }) =>
			append(
				"src/content/docs/2.x/api/ignite-core.mdx",
				"Install ignite-element@3.0.0-beta.12.",
			),
		/v3 package leaked/,
	));
test("archived v2 selector must be exact", () =>
	rejects(
		({ append }) =>
			append(
				"src/content/docs/2.x/api/ignite-core.mdx",
				"`pnpm add ignite-element@2.2.2-extra`",
			),
		/archived install must select exact v2.2.2/,
	));
test("mutable main source links fail", () =>
	rejects(
		({ append }) =>
			append(
				historicalInstallation,
				"https://github.com/0xjcf/ignite-element/tree/main/examples",
			),
		/mutable main link/,
	));
for (const version of [
	"3.0.0-beta.15",
	"3.0.0-beta.100",
	"3.0.0-rc.1",
	"3.0.0-beta.12-extra",
	"3.0.0-beta.12+build",
	"3.0.0-beta.012",
]) {
	test(`unverified future publication claim ${version} fails`, () =>
		rejects(
			({ append }) =>
				append(
					"src/content/docs/api/compatibility.mdx",
					`${version} is published.`,
				),
			/unpublished v3 artifact/,
		));
}
test("other packages are not mistaken for the facade", () =>
	passes(({ append }) =>
		append(
			historicalInstallation,
			"`pnpm add ignite-element-helper @example/ignite-element`",
		),
	));

test("Getting started cannot install historical beta.14", () =>
	rejects(
		({ replace }) =>
			replace(
				installation,
				"pnpm add ignite-element@beta xstate",
				"pnpm add ignite-element@3.0.0-beta.14 xstate",
			),
		/must install the beta channel/,
	));
test("Getting started must include the beta install command", () =>
	rejects(
		({ replace }) =>
			replace(
				installation,
				"pnpm add ignite-element@beta xstate",
				"pnpm add xstate",
			),
		/must install the beta channel/,
	));
test("publication copy cannot regain internal release instructions", () =>
	rejects(
		({ append }) => append(installation, "Use the candidate checkout."),
		/must show publication copy/,
	));

test("stable migration guidance does not teach early-beta APIs as v2", () => {
	const content = fs.readFileSync(
		path.join(site, "src/content/docs/migration/v3.mdx"),
		"utf8",
	);
	assert.doesNotMatch(
		content,
		/beta\.\d+|getView|watchView|record\(name\)|view:|Testing\/story retirement/,
	);
	assert.match(content, /v2 already supported this callback/);
	assert.match(
		content,
		/v2 command context exposed `actor`, `emit`, and `host`/,
	);
	assert.match(content, /v3 is native ESM-only/);
});
