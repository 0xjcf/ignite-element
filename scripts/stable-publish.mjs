import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PINNED_NPM_VERSION = "11.19.1";

const LEGACY_CREDENTIAL_KEYS = ["NPM_TOKEN", "NODE_AUTH_TOKEN"];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function assertNoLegacyNpmCredentials(env) {
	for (const key of LEGACY_CREDENTIAL_KEYS) {
		const value = env[key];
		if (typeof value === "string" && value.length > 0) {
			throw new Error(
				`Refusing to publish with ${key}. Use npm trusted publishing (OIDC) instead.`,
			);
		}
	}
}

export function assertPinnedNpmVersion(version) {
	if (version !== PINNED_NPM_VERSION) {
		throw new Error(
			`Refusing to publish with npm ${version}. The pinned publish client is ${PINNED_NPM_VERSION}.`,
		);
	}
}

export function planStablePublish({ distReady, publishedVersions, version }) {
	if (!distReady) {
		throw new Error(
			"Refusing to publish without dist/ignite-element.es.js. Build first.",
		);
	}
	if (publishedVersions.includes(version)) {
		return { publish: false, reason: "already-published" };
	}
	return {
		publish: true,
		args: ["publish", "--provenance", "--access", "public", "--json"],
	};
}

export function formatChangesetTagLine(version, packageName) {
	return `${JSON.stringify({
		type: "git-tag",
		tag: `v${version}`,
		packageName,
	})}\n`;
}

export function runStablePublish({
	distReady,
	env,
	npmVersion,
	onPublished,
	packageName,
	publish,
	publishedVersions,
	version,
}) {
	assertNoLegacyNpmCredentials(env);
	assertPinnedNpmVersion(npmVersion);
	const plan = planStablePublish({ distReady, publishedVersions, version });
	if (!plan.publish) return plan;
	publish(plan.args);
	const tagLine = formatChangesetTagLine(version, packageName);
	onPublished?.({ tagLine });
	return { ...plan, tagLine };
}

function readPublishedVersions(packageName) {
	try {
		const stdout = execFileSync(
			"npm",
			["view", packageName, "versions", "--json"],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		).trim();
		if (stdout.length === 0) return [];
		const parsed = JSON.parse(stdout);
		if (Array.isArray(parsed)) return parsed.map(String);
		if (typeof parsed === "string") return [parsed];
		return [];
	} catch (error) {
		const stderr =
			error && typeof error === "object" && "stderr" in error
				? String(error.stderr)
				: "";
		if (stderr.includes("E404")) return [];
		throw new Error(`Unable to read published versions for ${packageName}.`);
	}
}

function publishCli() {
	const env = process.env;
	assertNoLegacyNpmCredentials(env);
	const npmVersion = execFileSync("npm", ["--version"], {
		encoding: "utf8",
	}).trim();
	const manifest = JSON.parse(
		readFileSync(path.join(root, "package.json"), "utf8"),
	);
	const distReady = existsSync(path.join(root, "dist", "ignite-element.es.js"));
	const publishedVersions = distReady
		? readPublishedVersions(manifest.name)
		: [];
	const result = runStablePublish({
		distReady,
		env,
		npmVersion,
		packageName: manifest.name,
		publish: (args) => {
			execFileSync("npm", args, { cwd: root, stdio: "inherit" });
		},
		publishedVersions,
		version: manifest.version,
		onPublished: ({ tagLine }) => {
			const outputFile = env.CHANGESETS_OUTPUT;
			if (typeof outputFile === "string" && outputFile.length > 0) {
				appendFileSync(outputFile, tagLine);
			}
		},
	});
	if (!result.publish) {
		console.log(
			`Stable publish skipped: ${manifest.name}@${manifest.version} is already on npm.`,
		);
		return;
	}
	console.log(
		`Published ${manifest.name}@${manifest.version} with provenance.`,
	);
}

const isDirectRun =
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
	try {
		publishCli();
	} catch (error) {
		console.error(
			error instanceof Error ? error.message : "Stable publish failed.",
		);
		process.exitCode = 1;
	}
}
