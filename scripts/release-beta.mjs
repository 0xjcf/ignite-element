#!/usr/bin/env node

import { execSync } from "node:child_process";
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
	console.log(`\n➡️  ${command}`);
	execSync(command, { stdio: "inherit", ...options });
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

const main = async () => {
	if (env.CI) {
		console.warn(
			"[release:beta] Running in CI. Ensure npm credentials and OTP are configured via environment variables.",
		);
	}

	ensureCleanWorkingTree();
	ensureNpmAuth();

	run("pnpm changeset status");
	run("pnpm test");
	run("pnpm build");

	run("pnpm changeset version");
	run("pnpm install --no-frozen-lockfile");

	console.log("\n[release:beta] Files staged for release:");
	execSync("git status --short", { stdio: "inherit" });

	const resolvedOtp = await resolveOtp();
	const publishEnv = { ...env };

	if (resolvedOtp) {
		publishEnv.NPM_CONFIG_OTP = resolvedOtp;
		console.log("[release:beta] Using provided OTP for npm publish.");
	}

	const publishCommand = `pnpm changeset publish --tag beta${dryRun ? " --dry-run" : ""}`;
	run(publishCommand, { env: publishEnv });

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
