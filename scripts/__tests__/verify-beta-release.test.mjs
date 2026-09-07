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
const metadata = (version = "3.0.0-beta.11") =>
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

function fixture(
	run,
	{ fail = false, expectedVersion = version, inspectNpm = false } = {},
) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-beta-fixture-"));
	const bin = path.join(root, "bin");
	const log = path.join(root, "requests.jsonl");
	fs.mkdirSync(bin);
	const realNpm = inspectNpm
		? fs.realpathSync(
				process.env.PATH.split(path.delimiter)
					.map((entry) => path.join(entry, "npm"))
					.find((entry) => fs.existsSync(entry)),
			)
		: null;
	fs.writeFileSync(path.join(root, "unusable-cache"), "not a directory");
	fs.writeFileSync(
		path.join(root, ".npmrc"),
		`//registry.npmjs.org/:_authToken=SYNTHETIC_PROJECT_TOKEN\n@ignite-element:registry=https://synthetic.invalid\ncache=${root}/ancestor-cache\nfetch-retries=17\n`,
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
import {spawnSync} from 'node:child_process';
const env = process.env;
const args = process.argv.slice(2);
let resolved;
if (${inspectNpm}) {
  const options = args.filter(arg => arg.startsWith('--prefix=') || arg.startsWith('--registry='));
  const inspect = flags => {
    const r = spawnSync(process.execPath, [${JSON.stringify(realNpm)}, 'config', 'list', ...flags, ...options], {env, encoding:'utf8', timeout:10000});
    if (r.error || r.signal || r.status !== 0) throw new Error('real npm configuration inspection failed');
    return r.stdout;
  };
  const listing = inspect([]);
  const config = JSON.parse(inspect(['--json']));
  resolved = {authPresent: listing.includes('//registry.npmjs.org/:_authToken'), scope:config['@ignite-element:registry'], cache:config.cache, retries:config['fetch-retries'], registry:config.registry};
}
const readEmpty = key => !!env[key] && fs.readFileSync(env[key], 'utf8') === '';
let cacheWritable = false;
try { fs.writeFileSync(path.join(env.NPM_CONFIG_CACHE, 'probe'), 'ok'); cacheWritable = true; } catch {}
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  args, cwd: process.cwd(), cache: env.NPM_CONFIG_CACHE, resolved,
  userEmpty: readEmpty('NPM_CONFIG_USERCONFIG'), globalEmpty: readEmpty('NPM_CONFIG_GLOBALCONFIG'),
  credentialsAbsent: !Object.values(env).some(v => v.includes('SYNTHETIC_')),
  projectEmpty: fs.existsSync(path.join(process.cwd(), '.npmrc')) && fs.readFileSync(path.join(process.cwd(), '.npmrc'), 'utf8') === '', cacheWritable,
}) + '\\n');
if (${fail}) { console.error('SYNTHETIC_SUBPROCESS_SECRET'); process.exit(23); }
const all = ${JSON.stringify(metadata(expectedVersion))};
const requested = args[1];
const name = args[2] === 'dist-tags' ? requested : requested.slice(0, requested.lastIndexOf('@'));
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
		...(inspectNpm ? { TMPDIR: root } : {}),
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
		if (inspectNpm) {
			// Positive control: real npm must discover this synthetic ancestor before
			// the verifier establishes its own boundary. No network command is run.
			const control = path.join(root, "control");
			fs.mkdirSync(control);
			for (const name of ["user.npmrc", "global.npmrc"])
				fs.writeFileSync(path.join(control, name), "");
			const controlEnv = {
				PATH: process.env.PATH,
				NPM_CONFIG_USERCONFIG: path.join(control, "user.npmrc"),
				NPM_CONFIG_GLOBALCONFIG: path.join(control, "global.npmrc"),
				NPM_CONFIG_CACHE: path.join(control, "cache"),
			};
			const inspect = (flags) => {
				const result = spawnSync(
					process.execPath,
					[realNpm, "config", "list", ...flags],
					{
						cwd: control,
						env: controlEnv,
						encoding: "utf8",
						timeout: 10000,
					},
				);
				assert.equal(result.error, undefined);
				assert.equal(result.signal, null);
				assert.equal(result.status, 0, "real npm control must execute");
				return result.stdout;
			};
			assert.match(inspect([]), /\/\/registry\.npmjs\.org\/:_authToken/);
			const config = JSON.parse(inspect(["--json"]));
			assert.equal(
				config["@ignite-element:registry"],
				"https://synthetic.invalid",
			);
			assert.equal(config["fetch-retries"], 17);
		}
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
							record.projectEmpty &&
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
		...[
			"01.2.3-beta.4",
			"1.02.3-beta.4",
			"1.2.03-beta.4",
			"1.2.3-beta.04",
			"3.0.0-beta.11\n",
			"3.0.0-beta.11\r\n",
			" 3.0.0-beta.11",
			"3.0.0-beta.11 ",
			"1.2.3-beta.",
		].map((value) => [value]),
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

for (const value of [
	"01.2.3-beta.4",
	"1.02.3-beta.4",
	"1.2.03-beta.4",
	"1.2.3-beta.04",
	"3.0.0-beta.11\n",
	"3.0.0-beta.11\r\n",
	" 3.0.0-beta.11",
	"3.0.0-beta.11 ",
	"1.2.3-beta.",
]) {
	test(`exported verifier rejects noncanonical ${JSON.stringify(value)} before npm`, () =>
		fixture(({ execute, requests }) => {
			const result = execute(process.execPath, [
				"--input-type=module",
				"-e",
				`import assert from 'node:assert/strict'; import {verifyApprovedRelease} from ${JSON.stringify(new URL("../verify-beta-release.mjs", import.meta.url).href)}; assert.throws(()=>verifyApprovedRelease(${JSON.stringify(value)}), /usage:/i);`,
			]);
			assert.equal(result.status, 0, result.stderr);
			assert.deepEqual(requests(), []);
		}));
}

for (const value of ["0.0.0-beta.0", "0.1.0-beta.0", "1.0.0-beta.10"]) {
	test(`canonical zero boundaries accept ${value}`, () =>
		fixture(
			({ execute, requests }) => {
				for (const tool of ["node", "pnpm"])
					for (const separator of [[], ["--"]]) {
						const result = execute(tool === "node" ? process.execPath : tool, [
							...(tool === "node"
								? [verifier]
								: ["run", "release:beta:verify"]),
							...separator,
							value,
						]);
						assert.equal(result.status, 0, result.stderr);
					}
				const result = execute(process.execPath, [
					"--input-type=module",
					"-e",
					`import {verifyApprovedRelease} from ${JSON.stringify(new URL("../verify-beta-release.mjs", import.meta.url).href)}; verifyApprovedRelease(${JSON.stringify(value)});`,
				]);
				assert.equal(result.status, 0, result.stderr);
				assert.equal(requests().length, 40);
			},
			{ expectedVersion: value },
		));
}

test("actual npm excludes ancestor project configuration under nested TMPDIR", () =>
	fixture(
		({ execute, requests, root }) => {
			const result = execute(process.execPath, [verifier, version]);
			assert.equal(result.status, 0, result.stderr);
			const records = requests();
			assert.equal(records.length, 8);
			for (const record of records) {
				assert.equal(path.dirname(record.cwd), root);
				assert.equal(
					record.resolved.authPresent,
					false,
					"ancestor auth must not load",
				);
				assert.equal(
					record.resolved.scope,
					undefined,
					"ancestor scoped registry must not load",
				);
				assert.equal(record.resolved.cache, record.cache);
				assert.notEqual(record.resolved.retries, 17);
				assert.equal(record.resolved.registry, "https://registry.npmjs.org/");
				assert.equal(fs.existsSync(record.cwd), false);
			}
		},
		{ inspectNpm: true },
	));

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
