import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertApprovedRelease } from "../verify-beta-release.mjs";

const verifier = fileURLToPath(
	new URL("../verify-beta-release.mjs", import.meta.url),
);
const version = "3.0.0-beta.11";
const names = [
	"@ignite-element/core",
	"@ignite-element/adapters",
	"@ignite-element/renderer",
	"ignite-element",
];
const metadata = () =>
	Object.fromEntries(
		names.map((name) => [
			name,
			{
				version,
				tags: {
					beta: version,
					latest: name === "ignite-element" ? "2.2.2" : version,
				},
				dependencies:
					name === "ignite-element" ? { "@ignite-element/core": version } : {},
				dist: {
					attestations: { url: "https://registry.npmjs.org/attestation" },
				},
			},
		]),
	);

function fixture(run, { fail = false } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-beta-fixture-"));
	const bin = path.join(root, "bin");
	const log = path.join(root, "requests.jsonl");
	fs.mkdirSync(bin);
	fs.writeFileSync(path.join(root, "unusable-cache"), "not a directory");
	fs.writeFileSync(
		path.join(root, ".npmrc"),
		"//registry.npmjs.org/:_authToken=SYNTHETIC_PROJECT_TOKEN\n",
	);
	fs.writeFileSync(
		path.join(root, "package.json"),
		JSON.stringify({
			private: true,
			packageManager: "pnpm@10.33.0",
			scripts: { "release:beta:verify": `node ${JSON.stringify(verifier)}` },
		}),
	);
	fs.writeFileSync(
		path.join(bin, "npm"),
		`#!${process.execPath}
import fs from 'node:fs';
import path from 'node:path';
const env = process.env;
const args = process.argv.slice(2);
const readEmpty = key => !!env[key] && fs.readFileSync(env[key], 'utf8') === '';
let cacheWritable = false;
try { fs.writeFileSync(path.join(env.NPM_CONFIG_CACHE, 'probe'), 'ok'); cacheWritable = true; } catch {}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  args, cwd: process.cwd(), cache: env.NPM_CONFIG_CACHE,
  userEmpty: readEmpty('NPM_CONFIG_USERCONFIG'), globalEmpty: readEmpty('NPM_CONFIG_GLOBALCONFIG'),
  credentialsAbsent: !Object.values(env).some(v => v.includes('SYNTHETIC_')),
  projectAbsent: !fs.existsSync(path.join(process.cwd(), '.npmrc')), cacheWritable,
}) + '\\n');
if (${fail}) { console.error('SYNTHETIC_SUBPROCESS_SECRET'); process.exit(23); }
const all = ${JSON.stringify(metadata())};
const requested = args[1];
const name = requested.includes('@3.') ? requested.slice(0, requested.lastIndexOf('@')) : requested;
console.log(JSON.stringify(args[2] === 'dist-tags' ? all[name]?.tags : all[name]));
`,
		{ mode: 0o755 },
	);
	const env = {
		...process.env,
		PATH: `${bin}${path.delimiter}${process.env.PATH}`,
		NPM_TOKEN: "SYNTHETIC_NPM_TOKEN",
		NODE_AUTH_TOKEN: "SYNTHETIC_NODE_TOKEN",
		npm_config_cache: path.join(root, "unusable-cache"),
		npm_config_registry: "https://SYNTHETIC_INVALID.invalid",
		NPM_CONFIG_USERCONFIG: path.join(root, ".npmrc"),
	};
	const execute = (command, args) =>
		spawnSync(command, args, {
			cwd: root,
			env,
			encoding: "utf8",
			timeout: 30000,
		});
	const requests = () =>
		fs.existsSync(log)
			? fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse)
			: [];
	try {
		run({ execute, requests, root });
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

for (const tool of ["node", "pnpm"]) {
	for (const separator of [[], ["--"]]) {
		test(`${tool} supports ${JSON.stringify([...separator, version])} through the real CLI`, () =>
			fixture(({ execute, requests }) => {
				if (tool === "pnpm")
					assert.equal(execute("pnpm", ["--version"]).stdout.trim(), "10.33.0");
				const prefix =
					tool === "node" ? [verifier] : ["run", "release:beta:verify"];
				const result = execute(tool === "node" ? process.execPath : "pnpm", [
					...prefix,
					...separator,
					version,
				]);
				assert.equal(result.status, 0, result.stderr);
				const records = requests();
				assert.equal(records.length, 8);
				assert.equal(new Set(records.map((r) => r.cwd)).size, 1);
				assert.equal(new Set(records.map((r) => r.cache)).size, 1);
				for (const record of records) {
					assert.ok(
						record.credentialsAbsent &&
							record.projectAbsent &&
							record.userEmpty &&
							record.globalEmpty &&
							record.cacheWritable,
					);
					assert.ok(
						record.args.includes("--registry=https://registry.npmjs.org"),
					);
					assert.equal(
						fs.existsSync(record.cwd),
						false,
						"execution workspace removed",
					);
					assert.equal(
						fs.existsSync(record.cache),
						false,
						"execution cache removed",
					);
				}
			}));
	}
	for (const args of [
		[],
		["--"],
		["--", "--", version],
		[version, "extra"],
		["--help"],
		["3.0.0"],
		["garbage"],
		["3.0.0-beta.11+build"],
	]) {
		test(`${tool} rejects ${JSON.stringify(args)} before npm`, () =>
			fixture(({ execute, requests }) => {
				const result = execute(tool === "node" ? process.execPath : "pnpm", [
					...(tool === "node" ? [verifier] : ["run", "release:beta:verify"]),
					...args,
				]);
				assert.notEqual(result.status, 0);
				assert.match(result.stderr, /usage:/i);
				assert.deepEqual(requests(), []);
			}));
	}
}

test("exported verifier rejects invalid input before npm", () =>
	fixture(({ execute, requests }) => {
		const result = execute(process.execPath, [
			"--input-type=module",
			"-e",
			`import { verifyApprovedRelease } from ${JSON.stringify(new URL("../verify-beta-release.mjs", import.meta.url).href)}; for (const value of [undefined, null, 3, {}, [], '3.0.0', '--']) { try { verifyApprovedRelease(value); process.exit(2); } catch (error) { if (!/usage:/i.test(error.message)) throw error; } }`,
		]);
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(requests(), []);
	}));

test("subprocess failure remains failure, is sanitized, and cleans its workspace", () =>
	fixture(
		({ execute, requests }) => {
			const result = execute(process.execPath, [verifier, version]);
			assert.equal(result.status, 1);
			assert.match(result.stderr, /23/);
			assert.doesNotMatch(result.stderr, /SYNTHETIC_/);
			assert.equal(requests().length, 1);
			for (const record of requests()) {
				assert.equal(fs.existsSync(record.cwd), false);
				assert.equal(fs.existsSync(record.cache), false);
			}
		},
		{ fail: true },
	));

test("approved metadata preserves version, tags, dependency and attestation guarantees", () => {
	assert.equal(
		assertApprovedRelease({ expectedVersion: version, metadata: metadata() }),
		true,
	);
	for (const name of names) {
		for (const mutate of [
			(r) => {
				r.version = "3.0.0-beta.10";
			},
			(r) => {
				r.tags.beta = "3.0.0-beta.10";
			},
			(r) => {
				r.tags.latest = "3.0.0";
			},
			(r) => {
				delete r.dist.attestations;
			},
			(r) => {
				r.dependencies = { "@ignite-element/core": `^${version}` };
			},
		]) {
			const records = metadata();
			mutate(records[name]);
			assert.throws(() =>
				assertApprovedRelease({ expectedVersion: version, metadata: records }),
			);
		}
	}
});
