#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { env, exit, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getOption = (prefix) =>
	args
		.find((arg) => arg.startsWith(`${prefix}=`))
		?.slice(prefix.length + 1)
		.trim() ?? undefined;

const dryRun = hasFlag("--dry-run");
const skipOtp = hasFlag("--skip-otp");
const otp = getOption("--otp");

const run = (command, options = {}) => {
	const { onError, ...execOptions } = options;
	console.log(`\n➡️  ${command}`);
	try {
		execSync(command, { stdio: "inherit", ...execOptions });
	} catch (error) {
		if (typeof onError === "function") {
			onError(error);
		}
		throw error;
	}
};

const ensureCleanWorkingTree = () => {
	const status = execSync("git status --porcelain", {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();

	if (status) {
		console.error(
			"[release:beta] Working tree is not clean. Commit or stash changes before releasing.",
		);
		exit(1);
	}
};

const ensureNpmAuth = () => {
	try {
		const username = execSync("npm whoami", {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "inherit"],
		}).trim();
		console.log(`[release:beta] Authenticated with npm as ${username}`);
	} catch {
		console.error(
			"[release:beta] Unable to determine npm user. Run `npm login` before releasing.",
		);
		exit(1);
	}
};

const resolveOtp = async () => {
	if (skipOtp) {
		console.log("[release:beta] Skipping OTP prompt (--skip-otp)");
		return undefined;
	}

	if (otp) {
		return otp;
	}

	if (env.NPM_CONFIG_OTP) {
		return env.NPM_CONFIG_OTP;
	}

	const rl = createInterface({ input: stdin, output: stdout });
	const answer = (
		await rl.question(
			"[release:beta] Enter npm one-time password (leave blank to skip): ",
		)
	).trim();
	await rl.close();
	return answer || undefined;
};

// Returns the changeset files that have NOT yet been applied. In pre-release
// mode, `.changeset/pre.json` records the ids already consumed by a previous
// `changeset version`, so a committed pre-release bump leaves zero pending even
// though the .md files are retained until `changeset pre exit`.
const getPendingChangesets = () => {
	const dir = ".changeset";
	if (!existsSync(dir)) {
		return [];
	}

	const changesetFiles = readdirSync(dir).filter(
		(file) => file.endsWith(".md") && file !== "README.md",
	);

	let applied = [];
	const preFile = `${dir}/pre.json`;
	if (existsSync(preFile)) {
		try {
			applied = JSON.parse(readFileSync(preFile, "utf8")).changesets ?? [];
		} catch {
			applied = [];
		}
	}

	return changesetFiles.filter(
		(file) => !applied.includes(file.replace(/\.md$/, "")),
	);
};

// In pre-release mode, changesets publishes under the configured pre tag
// automatically and REJECTS an explicit `--tag`. Detect it so we only pass
// `--tag beta` for a non-pre ("normal") publish.
const isPreMode = () => {
	const preFile = ".changeset/pre.json";
	if (!existsSync(preFile)) {
		return false;
	}
	try {
		return JSON.parse(readFileSync(preFile, "utf8")).mode === "pre";
	} catch {
		return false;
	}
};

// Print the version bumps that `changeset version` WOULD apply, without touching
// any files. `changeset status --output` writes a release plan (old -> new per
// package) computed the same way as `version`, so this previews the exact next
// version (e.g. 3.0.0-beta.2 -> 3.0.0-beta.3 in pre mode). `--dry-run` never
// bumps, so this is the only place the next version is visible before publishing.
const printPlannedVersions = () => {
	const out = ".release-beta-plan.json";
	try {
		execSync(`pnpm changeset status --output=${out}`, { stdio: "ignore" });
		const plan = JSON.parse(readFileSync(out, "utf8"));
		const releases = (plan.releases ?? []).filter((r) => r.type !== "none");
		if (releases.length === 0) {
			console.log(
				"[release:beta] No pending changesets — no version bump (current versions would publish as-is).",
			);
			return;
		}
		console.log("\n[release:beta] Planned version bumps:");
		for (const r of releases) {
			console.log(`  ${r.name}: ${r.oldVersion} → ${r.newVersion} (${r.type})`);
		}
	} catch (error) {
		console.warn(
			`[release:beta] Could not compute planned versions: ${
				error instanceof Error ? error.message : error
			}`,
		);
	} finally {
		rmSync(out, { force: true });
	}
};

const main = async () => {
	// Disable husky for every command this script spawns. `changeset version`
	// (config `commit: true`) makes its own git commit with the message
	// "RELEASING: Releasing N package(s)", which the commit-msg hook (commitlint,
	// conventional) rejects — changeset then aborts ("ran into trouble committing
	// your files") AFTER bumping versions but BEFORE publishing. Hooks add no
	// value to this mechanical, already-verified release commit. This mirrors CI
	// (the `release` job in .github/workflows/ci.yml sets `HUSKY: 0`) so the
	// command is just `pnpm release:beta` — no `HUSKY=0` prefix needed.
	env.HUSKY = "0";

	if (env.CI) {
		console.warn(
			"[release:beta] Running in CI. Ensure npm credentials and OTP are configured via environment variables.",
		);
	}

	ensureCleanWorkingTree();

	// A dry run never publishes, so it does not need npm credentials.
	if (!dryRun) {
		ensureNpmAuth();
	}

	// Informational only. `changeset status` exits non-zero when packages changed
	// but no *pending* changeset exists — the normal state once a pre-release bump
	// has already been versioned and committed. Decide what to do from the actual
	// changeset files instead of treating this as a hard gate.
	try {
		run("pnpm changeset status");
	} catch {
		console.warn(
			"[release:beta] `changeset status` found no pending changesets — continuing; versions may already be bumped.",
		);
	}

	run("pnpm test");
	run("pnpm build");

	const pendingChangesets = getPendingChangesets();

	if (dryRun) {
		console.log(
			"\n[release:beta] Dry run — not versioning, installing, or publishing.",
		);
		console.log(
			pendingChangesets.length > 0
				? `[release:beta] ${pendingChangesets.length} pending changeset(s) would be applied by \`changeset version\`.`
				: "[release:beta] No pending changesets; current package versions would be published as-is.",
		);
		// Show the actual next version(s) — the real run bumps these before publish.
		printPlannedVersions();
		// IMPORTANT: `changeset publish --dry-run` is NOT honored by changesets and
		// performs a real publish. Use pnpm's publish dry-run, which only packs the
		// tarballs and writes nothing to the registry, for a genuinely inert preview.
		run("pnpm -r publish --dry-run --no-git-checks --tag beta");
		console.log(
			"\n✅ Dry run complete. No versions were bumped and nothing was published.",
		);
		return;
	}

	if (pendingChangesets.length > 0) {
		printPlannedVersions();
		run("pnpm changeset version");
		run("pnpm install --no-frozen-lockfile");
	} else {
		console.log(
			"[release:beta] No pending changesets — skipping `changeset version` (versions already bumped).",
		);
	}

	console.log("\n[release:beta] Files staged for release:");
	execSync("git status --short", { stdio: "inherit" });

	const resolvedOtp = await resolveOtp();
	const publishEnv = { ...env };

	if (resolvedOtp) {
		publishEnv.NPM_CONFIG_OTP = resolvedOtp;
		console.log("[release:beta] Using provided OTP for npm publish.");
	}

	// changeset publish has no real dry-run (the dry-run path returns above), so
	// this is always a real publish. In pre mode changesets auto-targets the pre
	// tag (beta) and rejects an explicit `--tag`; only pass it for a normal release.
	const publishCmd = isPreMode()
		? "pnpm changeset publish"
		: "pnpm changeset publish --tag beta";
	run(publishCmd, { env: publishEnv });

	console.log(
		"\n✅ Beta release complete. Review git status, commit the changes, and push tags to share the release.",
	);
};

main().catch((error) => {
	console.error("\n[release:beta] Release script failed.");
	if (error instanceof Error) {
		console.error(error.message);
	} else {
		console.error(error);
	}
	exit(1);
});
