import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { planRelease } from "../release-plan.mjs";
import {
	assertNoLegacyNpmCredentials,
	assertPinnedNpmVersion,
	formatChangesetTagLine,
	PINNED_NPM_VERSION,
	planStablePublish,
	runStablePublish,
} from "../stable-publish.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workflowsDir = join(root, ".github/workflows");
const actionsOpen = `$${"{{"}`;

const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const actionUses = (workflow) =>
	[...workflow.matchAll(/^\s*uses:\s*([^@\s]+)@([^\s#]+)/gm)].map(
		([, action, revision]) => ({ action, revision }),
	);

describe("publish hygiene", () => {
	it("removes the token refresh script and workflow", () => {
		for (const relativePath of [
			".github/workflows/refresh-token.yml",
			"scripts/refresh-npm-token.js",
			"scripts/__tests__/refresh-npm-token.test.js",
		]) {
			expect(existsSync(join(root, relativePath)), relativePath).toBe(false);
		}
	});

	it("does not create or print npm tokens anywhere in automation", () => {
		for (const name of readdirSync(workflowsDir)) {
			const source = readFileSync(join(workflowsDir, name), "utf8");
			expect(source, name).not.toMatch(/npm token create/);
			expect(source, name).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
		}
		const publisher = read("scripts/stable-publish.mjs");
		expect(publisher).not.toMatch(/npm token create/);
		expect(publisher).not.toMatch(/console\.log\([^)]*token/i);
	});

	it("keeps CI validation-only, least privilege, and SHA-pinned", () => {
		const workflow = read(".github/workflows/ci.yml");
		expect(workflow).toMatch(/^name: CI\n/);
		expect(workflow).toMatch(/^permissions: \{\}$/m);
		expect(workflow).not.toMatch(/^ {2}release:/m);
		expect(workflow).not.toMatch(/id-token:\s*write/);
		expect(workflow).not.toMatch(
			/changesets\/action|npm publish|pnpm publish|changeset publish/,
		);
		expect(workflow).toMatch(/^ {2}build:/m);
		expect(workflow).toMatch(/^ {2}examples-typecheck:/m);
		expect(workflow.match(/contents: read/g)?.length).toBe(2);
		expect(workflow.match(/pnpm install --frozen-lockfile/g)?.length).toBe(2);
		expect(workflow).toContain("persist-credentials: false");
		expect(workflow).toContain("pnpm run test:node");
		expect(workflow).toContain(
			"pnpm exec tsc --project src/examples/xstate/tsconfig.json",
		);
		expect(workflow).toContain(
			"pnpm exec tsc --project src/examples/redux/tsconfig.json",
		);

		const uses = actionUses(workflow);
		expect(uses.length).toBeGreaterThan(0);
		for (const { revision } of uses) {
			expect(revision).toMatch(/^[0-9a-f]{40}$/);
		}
	});

	it("publishes from the tested main commit with OIDC and provenance", () => {
		const workflow = read(".github/workflows/release.yml");
		expect(workflow).toMatch(/^permissions: \{\}$/m);
		expect(workflow).toMatch(/workflows: \["CI"\]/);
		expect(workflow).toMatch(/github\.event\.workflow_run\.event == 'push'/);
		expect(workflow).toMatch(
			/github\.event\.workflow_run\.head_branch == 'main'/,
		);
		expect(workflow).toContain(
			`ref: ${actionsOpen} github.event.workflow_run.head_sha }}`,
		);
		expect(workflow).toContain("persist-credentials: false");
		expect(workflow).toContain("package-manager-cache: false");
		expect(workflow).toContain("pnpm install --frozen-lockfile");
		expect(workflow).toContain(`npm@${PINNED_NPM_VERSION}`);
		expect(workflow).toContain("environment: npm");
		expect(workflow).toMatch(/id-token: write/);
		expect(workflow).toMatch(/contents: write/);
		expect(workflow).toMatch(/pull-requests: write/);
		expect(workflow).toContain("node scripts/release-plan.mjs");
		expect(workflow).toContain("pnpm exec changeset version");
		expect(workflow).toContain("node scripts/stable-publish.mjs");
		expect(workflow).not.toMatch(/changesets\/action/);
		expect(workflow).toMatch(/NPM_CONFIG_PROVENANCE: "true"/);
		expect(workflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|secrets\./);
		expect(workflow.match(/id-token: write/g)?.length).toBe(1);

		for (const { revision } of actionUses(workflow)) {
			expect(revision).toMatch(/^[0-9a-f]{40}$/);
		}
	});

	it("leaves the beta staging workflow SHA-pinned and token-free", () => {
		const workflow = read(".github/workflows/publish.yml");
		expect(workflow).toMatch(/^permissions: \{\}$/m);
		expect(workflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
		expect(workflow).toMatch(/refs\/heads\/beta/);
		const uses = actionUses(workflow);
		expect(uses.length).toBeGreaterThan(0);
		for (const { revision } of uses) {
			expect(revision).toMatch(/^[0-9a-f]{40}$/);
		}
	});

	it("refuses legacy npm credentials without echoing them", () => {
		const token = "npm_secret_token_value";
		expect(() => assertNoLegacyNpmCredentials({ NPM_TOKEN: token })).toThrow(
			/NPM_TOKEN/,
		);
		expect(() =>
			assertNoLegacyNpmCredentials({ NODE_AUTH_TOKEN: token }),
		).toThrow(/NODE_AUTH_TOKEN/);
		try {
			assertNoLegacyNpmCredentials({ NPM_TOKEN: token });
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect(error.message).not.toContain(token);
		}
		expect(() =>
			assertNoLegacyNpmCredentials({ NPM_TOKEN: "", NODE_AUTH_TOKEN: "" }),
		).not.toThrow();
	});

	it("publishes with the pinned npm client and provenance", () => {
		expect(PINNED_NPM_VERSION).toBe("11.19.1");
		expect(() => assertPinnedNpmVersion("10.9.2")).toThrow(/11\.19\.1/);
		expect(() => assertPinnedNpmVersion(PINNED_NPM_VERSION)).not.toThrow();

		expect(() =>
			planStablePublish({
				distReady: false,
				publishedVersions: [],
				version: "2.2.2",
			}),
		).toThrow(/dist\/ignite-element\.es\.js/);

		expect(
			planStablePublish({
				distReady: true,
				publishedVersions: ["2.2.2"],
				version: "2.2.2",
			}),
		).toEqual({ publish: false, reason: "already-published" });

		expect(
			planStablePublish({
				distReady: true,
				publishedVersions: ["2.2.1"],
				version: "2.2.2",
			}),
		).toEqual({
			publish: true,
			args: ["publish", "--provenance", "--access", "public", "--json"],
		});
	});

	it("skips an already published version and does not call npm", () => {
		const publish = vi.fn();
		const onPublished = vi.fn();
		expect(
			runStablePublish({
				distReady: true,
				env: {},
				npmVersion: PINNED_NPM_VERSION,
				onPublished,
				packageName: "ignite-element",
				publish,
				publishedVersions: ["2.2.2"],
				version: "2.2.2",
			}),
		).toEqual({ publish: false, reason: "already-published" });
		expect(publish).not.toHaveBeenCalled();
		expect(onPublished).not.toHaveBeenCalled();
	});

	it("publishes once and records a v-prefixed tag for changesets", () => {
		const publish = vi.fn();
		const onPublished = vi.fn();
		const plan = runStablePublish({
			distReady: true,
			env: { NPM_TOKEN: "" },
			npmVersion: PINNED_NPM_VERSION,
			onPublished,
			packageName: "ignite-element",
			publish,
			publishedVersions: [],
			version: "2.3.0",
		});
		expect(plan).toMatchObject({ publish: true });
		expect(publish).toHaveBeenCalledWith([
			"publish",
			"--provenance",
			"--access",
			"public",
			"--json",
		]);
		expect(formatChangesetTagLine("2.3.0", "ignite-element")).toBe(
			`${JSON.stringify({
				type: "git-tag",
				tag: "v2.3.0",
				packageName: "ignite-element",
			})}\n`,
		);
		expect(onPublished).toHaveBeenCalledWith({
			tagLine: formatChangesetTagLine("2.3.0", "ignite-element"),
		});
	});

	it("does not publish when a legacy token is present", () => {
		const publish = vi.fn();
		expect(() =>
			runStablePublish({
				distReady: true,
				env: { NPM_TOKEN: "do-not-print" },
				npmVersion: PINNED_NPM_VERSION,
				packageName: "ignite-element",
				publish,
				publishedVersions: [],
				version: "2.3.0",
			}),
		).toThrow(/NPM_TOKEN/);
		expect(publish).not.toHaveBeenCalled();
	});

	it("versions only when a changeset markdown file is pending", () => {
		expect(planRelease(["README.md"])).toBe("publish");
		expect(planRelease([])).toBe("publish");
		expect(planRelease(["README.md", "fix-buttons.md"])).toBe("version");
		expect(planRelease(["readme.md"])).toBe("publish");
	});

	it("points the package release script at trusted publishing", () => {
		const manifest = JSON.parse(read("package.json"));
		expect(manifest.scripts?.release).toBe("node ./scripts/stable-publish.mjs");
		expect(manifest.scripts?.postrelease).toBeUndefined();
	});
});
