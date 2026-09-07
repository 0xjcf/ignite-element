import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	assertFixtureGitOwnership,
	fixtureGitEnvironment,
} from "./helpers/git-fixture-env.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
// The regression harness must be safe even when testing the broken baseline.
// None of the invoking repository's Git environment reaches sentinel setup.
const harnessEnv = fixtureGitEnvironment(
	Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
	),
);
delete harnessEnv.NODE_TEST_CONTEXT;

test("synthetic global hooks cannot replace sentinel or nested fixture hooks", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "ignite-global-hooks-"));
	try {
		const home = path.join(root, "home");
		const hooks = path.join(root, "external-hooks");
		const marker = path.join(root, "external-hook-ran");
		const baseline = path.join(root, "baseline");
		const receiver = path.join(root, "receiver.git");
		fs.mkdirSync(baseline);
		write(home, ".gitconfig", `[core]\n\thooksPath = ${hooks}\n`);
		for (const name of ["pre-commit", "pre-push"]) {
			write(
				hooks,
				name,
				`#!${process.execPath}\nrequire('node:fs').appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(`${name}\n`)});\n`,
			);
			fs.chmodSync(path.join(hooks, name), 0o755);
		}
		const injected = {
			...harnessEnv,
			HOME: home,
			XDG_CONFIG_HOME: home,
			GIT_CONFIG_GLOBAL: path.join(home, ".gitconfig"),
			GIT_CONFIG_SYSTEM: os.devNull,
			GIT_CONFIG_NOSYSTEM: "1",
			TMPDIR: root,
		};
		const baselineGit = (...args) => {
			const result = command(baseline, "git", args, injected);
			assert.equal(result.status, 0, result.stderr);
			return result.stdout.trim();
		};
		baselineGit("init", "-b", "sentinel");
		baselineGit("config", "user.name", "Synthetic Owner");
		baselineGit("config", "user.email", "synthetic@example.invalid");
		write(baseline, "tracked", "baseline\n");
		baselineGit("add", "tracked");
		baselineGit("commit", "-m", "baseline");
		baselineGit("init", "--bare", receiver);
		assert.equal(baselineGit("config", "--get", "core.hooksPath"), hooks);
		baselineGit("push", receiver, "HEAD:refs/heads/candidate");
		assert.match(
			fs.readFileSync(marker, "utf8"),
			/pre-push/,
			"positive control must execute the synthetic global hook",
		);
		fs.unlinkSync(marker);
		const result = command(
			source,
			process.execPath,
			[
				"--test",
				"--test-name-pattern=^real pre-push fixture isolation: (direct|linked)$",
				fileURLToPath(import.meta.url),
			],
			injected,
		);
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stdout, /real pre-push fixture isolation: direct/);
		assert.match(result.stdout, /real pre-push fixture isolation: linked/);
		assert.match(result.stdout, /# fail 0\n/);
		assert.equal(
			fs.existsSync(marker),
			false,
			"synthetic global hooks must not execute in either fixture layer",
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

function command(cwd, program, args, env = harnessEnv) {
	const result = spawnSync(program, args, {
		cwd,
		env,
		encoding: "utf8",
		timeout: 30000,
	});
	assert.equal(result.error, undefined, `launch failed: ${result.error}`);
	assert.equal(result.signal, null, "subprocess must not terminate by signal");
	return result;
}
function git(cwd, ...args) {
	const result = command(cwd, "git", args);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
}
function write(root, name, content) {
	const file = path.join(root, name);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
}
function custody(parent, checkout) {
	const directory = git(checkout, "rev-parse", "--absolute-git-dir");
	return {
		config: fs.readFileSync(path.join(parent, ".git/config"), "utf8"),
		parentHead: fs.readFileSync(path.join(parent, ".git/HEAD"), "utf8"),
		parentIndex: fs
			.readFileSync(path.join(parent, ".git/index"))
			.toString("hex"),
		head: fs.readFileSync(path.join(directory, "HEAD"), "utf8"),
		index: fs.readFileSync(path.join(directory, "index")).toString("hex"),
		refs: git(parent, "for-each-ref", "--format=%(refname) %(objectname)"),
		files: git(checkout, "ls-files", "-z")
			.split("\0")
			.filter(Boolean)
			.map((name) => [
				name,
				fs.readFileSync(path.join(checkout, name)).toString("hex"),
			]),
	};
}
function assertHookEvidence(result, record, expectedFailure = false) {
	assert.equal(result.error, undefined);
	assert.equal(result.signal, null);
	assert.ok(record, `real hook must produce evidence: ${result.stderr}`);
	assert.equal(record.error, null, "test runner must launch normally");
	assert.equal(record.signal, null);
	assert.match(record.output, /# tests 4\n/);
	assert.match(
		record.output,
		/preserves the first leading-dot path during real beta preparation/,
	);
	assert.doesNotMatch(
		record.output,
		/ERR_MODULE_NOT_FOUND|ENOENT|browserType\.launch/,
	);
	if (expectedFailure) {
		assert.notEqual(result.status, 0);
		assert.notEqual(record.status, 0);
		assert.match(record.output, /intentional isolation propagation failure/);
		assert.match(record.output, /# pass 3\n/);
		assert.match(record.output, /# fail 1\n/);
	} else {
		assert.equal(record.status, 0, record.output);
		assert.equal(result.status, 0, result.stderr);
		assert.match(record.output, /# pass 4\n/);
		assert.match(record.output, /# fail 0\n/);
	}
}

for (const mode of [
	"direct",
	"linked",
	"routing-and-config",
	"linked-routing-and-config",
	"config-parameters",
	"assertion-failure",
]) {
	test(`real pre-push fixture isolation: ${mode}`, (t) => {
		const root = fs.realpathSync(
			fs.mkdtempSync(path.join(os.tmpdir(), "ignite-git-isolation-")),
		);
		const parent = path.join(root, "sentinel");
		const receiver = path.join(root, "receiver.git");
		fs.mkdirSync(parent);
		try {
			git(parent, "init", "-b", "sentinel");
			git(parent, "config", "user.name", "Sentinel Owner");
			git(parent, "config", "user.email", "sentinel@example.invalid");
			write(parent, "package.json", '{"type":"module"}\n');
			for (const name of [
				"release-beta.test.mjs",
				"prepare-beta-release.mjs",
			]) {
				write(
					parent,
					`scripts/${name}`,
					fs.readFileSync(path.join(source, name)),
				);
			}
			const helpers = path.join(source, "__tests__/helpers");
			if (fs.existsSync(helpers))
				fs.cpSync(helpers, path.join(parent, "scripts/__tests__/helpers"), {
					recursive: true,
				});
			if (mode === "assertion-failure") {
				const file = path.join(parent, "scripts/release-beta.test.mjs");
				const original = fs.readFileSync(file, "utf8");
				assert.ok(
					original.includes('assert.equal(paths[0], ".changeset/pre.json");'),
				);
				fs.writeFileSync(
					file,
					original.replace(
						'assert.equal(paths[0], ".changeset/pre.json");',
						'assert.fail("intentional isolation propagation failure");',
					),
				);
			}
			git(parent, "add", ".");
			git(parent, "commit", "-m", "sentinel fixture");
			git(root, "init", "--bare", receiver);
			let checkout = parent;
			if (mode.startsWith("linked")) {
				checkout = path.join(root, "linked");
				git(parent, "worktree", "add", "--detach", checkout, "HEAD");
			}
			const gitdir = git(checkout, "rev-parse", "--absolute-git-dir");
			const evidence = path.join(root, "hook.json");
			const hook = path.join(parent, ".git/hooks/pre-push");
			write(
				parent,
				".git/hooks/pre-push",
				`#!${process.execPath}\nimport fs from 'node:fs';import {spawnSync} from 'node:child_process';
const env={...process.env};delete env.NODE_TEST_CONTEXT;
const r=spawnSync(process.execPath,['--test','--test-name-pattern=lossless porcelain status parsing','scripts/release-beta.test.mjs'],{env,encoding:'utf8',timeout:20000});
const target=spawnSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'});
fs.writeFileSync(${JSON.stringify(evidence)},JSON.stringify({names:Object.keys(process.env).filter(k=>k.startsWith('GIT_')),target:target.stdout.trim(),status:r.status,signal:r.signal,error:r.error?.code??null,output:r.stdout+r.stderr,args:process.argv.slice(2)}));
process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??1);\n`,
			);
			fs.chmodSync(hook, 0o755);
			const env = { ...harnessEnv, GIT_DIR: gitdir, TMPDIR: root };
			if (mode.endsWith("routing-and-config"))
				Object.assign(env, {
					GIT_WORK_TREE: checkout,
					GIT_COMMON_DIR: path.join(parent, ".git"),
					GIT_INDEX_FILE: path.join(gitdir, "index"),
					GIT_CONFIG_COUNT: "1",
					GIT_CONFIG_KEY_0: "core.worktree",
					GIT_CONFIG_VALUE_0: checkout,
				});
			if (mode === "config-parameters")
				env.GIT_CONFIG_PARAMETERS = `'core.worktree'='${checkout}'`;
			const before = custody(parent, checkout);
			const result = command(
				checkout,
				"git",
				[
					"push",
					"--porcelain",
					"--no-follow-tags",
					receiver,
					"HEAD:refs/heads/candidate",
				],
				env,
			);
			const record = fs.existsSync(evidence)
				? JSON.parse(fs.readFileSync(evidence))
				: null;
			t.diagnostic(
				JSON.stringify({
					mode,
					names: record?.names,
					target: record?.target,
					expectedTarget: gitdir,
					parentConfigChanged:
						before.config !==
						fs.readFileSync(path.join(parent, ".git/config"), "utf8"),
					parentHeadChanged:
						before.head !== fs.readFileSync(path.join(gitdir, "HEAD"), "utf8"),
					parentIndexChanged:
						before.index !==
						fs.readFileSync(path.join(gitdir, "index")).toString("hex"),
				}),
			);
			assertHookEvidence(result, record, mode === "assertion-failure");
			assert.ok(record.names.includes("GIT_DIR"));
			if (mode.endsWith("routing-and-config"))
				for (const name of [
					"GIT_WORK_TREE",
					"GIT_COMMON_DIR",
					"GIT_INDEX_FILE",
					"GIT_CONFIG_COUNT",
					"GIT_CONFIG_KEY_0",
					"GIT_CONFIG_VALUE_0",
				])
					assert.ok(record.names.includes(name), name);
			if (mode === "config-parameters")
				assert.ok(record.names.includes("GIT_CONFIG_PARAMETERS"));
			assert.equal(record.target, gitdir);
			assert.deepEqual(record.args, [receiver, receiver]);
			assert.deepEqual(custody(parent, checkout), before);
			const remote = git(
				root,
				"--git-dir",
				receiver,
				"for-each-ref",
				"--format=%(refname)",
			);
			assert.equal(
				remote,
				mode === "assertion-failure" ? "" : "refs/heads/candidate",
			);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
}

test("fixture environment removes routing and config injection without changing caller or tools", () => {
	const processBefore = JSON.stringify(process.env);
	const injected = {
		...harnessEnv,
		GIT_DIR: "/not-used",
		GIT_WORK_TREE: "/not-used",
		GIT_COMMON_DIR: "/not-used",
		GIT_INDEX_FILE: "/not-used",
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "core.worktree",
		GIT_CONFIG_VALUE_0: "/not-used",
		GIT_CONFIG_PARAMETERS: "invalid injection",
		GIT_CONFIG_GLOBAL: "/not-used",
		FIXTURE_SENTINEL: "preserved",
	};
	const before = { ...injected };
	const clean = fixtureGitEnvironment(injected);
	assert.ok(
		JSON.stringify(injected) === JSON.stringify(before),
		"caller environment unchanged",
	);
	assert.ok(
		JSON.stringify(process.env) === processBefore,
		"process environment unchanged",
	);
	for (const name of Object.keys(injected).filter(
		(key) =>
			key.startsWith("GIT_") &&
			![
				"GIT_CONFIG_GLOBAL",
				"GIT_CONFIG_SYSTEM",
				"GIT_CONFIG_NOSYSTEM",
			].includes(key),
	))
		assert.equal(clean[name], undefined);
	assert.equal(clean.GIT_CONFIG_GLOBAL, os.devNull);
	assert.equal(clean.GIT_CONFIG_SYSTEM, os.devNull);
	assert.equal(clean.GIT_CONFIG_NOSYSTEM, "1");
	assert.deepEqual(
		fixtureGitEnvironment(clean),
		clean,
		"a nested handoff must retain trusted configuration isolation",
	);
	assert.equal(clean.PATH, harnessEnv.PATH);
	assert.equal(clean.FIXTURE_SENTINEL, "preserved");
});

test("Git discovery and missing fixture setup fail closed", () => {
	const root = fs.mkdtempSync(
		path.join(os.tmpdir(), "ignite-discovery-control-"),
	);
	try {
		assert.throws(
			() => fixtureGitEnvironment({ PATH: root }),
			/discovery must launch/,
		);
		write(root, "git", "#!/bin/sh\nexit 42\n");
		fs.chmodSync(path.join(root, "git"), 0o755);
		assert.throws(
			() => fixtureGitEnvironment({ PATH: root }),
			/discovery failed/,
		);
		write(root, "git", "#!/bin/sh\nprintf 'not-valid\\n'\n");
		assert.throws(() => fixtureGitEnvironment({ PATH: root }), /invalid names/);
		assert.throws(
			() => assertFixtureGitOwnership(root, harnessEnv),
			/ownership check failed/,
		);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

for (const failure of [
	"launch",
	"module",
	"browser",
	"timeout",
	"signal",
	"missing evidence",
]) {
	test(`hook evidence rejects ${failure} infrastructure failure`, () => {
		const record = {
			status: 1,
			signal: null,
			error: null,
			output:
				"# tests 4\npreserves the first leading-dot path during real beta preparation\nintentional isolation propagation failure\n",
		};
		if (failure === "launch") record.error = "ENOENT";
		if (failure === "module") record.output += "ERR_MODULE_NOT_FOUND";
		if (failure === "browser") record.output += "browserType.launch";
		if (failure === "timeout") record.error = "ETIMEDOUT";
		if (failure === "signal") record.signal = "SIGTERM";
		assert.throws(() =>
			assertHookEvidence(
				{ status: 1, signal: null },
				failure === "missing evidence" ? null : record,
				true,
			),
		);
	});
}
