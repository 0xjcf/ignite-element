import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isMap, parseDocument } from "yaml";
import {
	inspectDocumentationWorkflow,
	inspectWorkflowPermissions,
} from "./check-docs-publication-contract.mjs";
import { cli, withSite } from "./review-fixtures.mjs";

const siteRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const workflow = fs.readFileSync(
	path.resolve(siteRoot, "../../.github/workflows/docs-contrast.yml"),
	"utf8",
);

test("production guard rejects a privileged deployment build", () =>
	withSite(({ root, site }) => {
		const file = path.join(root, ".github/workflows/docs-deploy.yml");
		fs.writeFileSync(
			file,
			fs
				.readFileSync(file, "utf8")
				.replace("contents: read", "contents: write"),
		);
		const result = cli(site, "check-docs-publication-contract.mjs");
		assert.notEqual(result.status, 0, result.output);
		assert.match(result.output, /build permissions/);
	}));

function addContrastPermission(permission) {
	return workflow.replace(
		"      contents: read",
		`      contents: read\n      ${permission}`,
	);
}

const unsafeWorkflows = new Map([
	["issues: write", addContrastPermission("issues: write")],
	["pull-requests: write", addContrastPermission("pull-requests: write")],
	["actions: write", addContrastPermission("actions: write")],
	["checks: write", addContrastPermission("checks: write")],
	["contents: write", workflow.replace("contents: read", "contents: write")],
	["id-token: write", addContrastPermission("id-token: write")],
	[
		"job-level permissions: write-all",
		workflow.replace(
			"    permissions:\n      contents: read",
			"    permissions: write-all",
		),
	],
	[
		"top-level permissions: read-all",
		workflow.replace("permissions: {}", "permissions: read-all"),
	],
	[
		"top-level permissions: write-all",
		workflow.replace("permissions: {}", "permissions: write-all"),
	],
	[
		"non-empty top-level permissions map",
		workflow.replace("permissions: {}", "permissions:\n  contents: read"),
	],
	[
		"poisoned top-level permissions map",
		workflow.replace(
			"permissions: {}",
			"permissions:\n  contents: read\n  issues: write",
		),
	],
	["additional issues: read permission", addContrastPermission("issues: read")],
	[
		"additional job with GitHub authority",
		workflow.replace(
			"jobs:\n  contrast:",
			"jobs:\n  authority:\n    permissions:\n      contents: read\n    runs-on: ubuntu-22.04\n    steps: []\n  contrast:",
		),
	],
	[
		"additional job without explicit authority",
		workflow.replace(
			"jobs:\n  contrast:",
			"jobs:\n  extra:\n    runs-on: ubuntu-22.04\n    steps: []\n  contrast:",
		),
	],
	[
		"duplicate ambiguous job permissions",
		workflow.replace(
			"      contents: read",
			"      contents: read\n    permissions: write-all",
		),
	],
	[
		"inline job permissions map",
		workflow.replace(
			"    permissions:\n      contents: read",
			"    permissions: { contents: read }",
		),
	],
	[
		"aliased job permissions",
		workflow
			.replace(
				"permissions: {}",
				"permission-template: &permission-template\n  contents: read\npermissions: {}",
			)
			.replace(
				"    permissions:\n      contents: read",
				"    permissions: *permission-template",
			),
	],
	[
		"duplicate top-level permissions",
		workflow.replace("permissions: {}", "permissions: {}\npermissions: {}"),
	],
	[
		"malformed permission indentation",
		workflow.replace("      contents: read", "       contents: read"),
	],
	[
		"missing job permissions",
		workflow.replace("    permissions:\n      contents: read\n", ""),
	],
	[
		"duplicate contents permission",
		workflow.replace(
			"      contents: read",
			"      contents: read\n      contents: read",
		),
	],
]);

test("accepts the exact authenticated documentation workflow", () => {
	assert.deepEqual(inspectWorkflowPermissions(workflow), []);
});

for (const [name, unsafeWorkflow] of unsafeWorkflows) {
	test(`rejects ${name}`, () => {
		assert.notDeepEqual(
			inspectWorkflowPermissions(unsafeWorkflow),
			[],
			`unsafe workflow was accepted: ${name}`,
		);
	});
}

const jobPermissionBlock = "    permissions:\n      contents: read";
const scalarDecoy =
	'    name: "Permission check\n    permissions:\n      contents: read\n    "';
const explicitKeyBypass = workflow.replace(
	jobPermissionBlock,
	`${scalarDecoy}\n    ? permissions\n    : write-all`,
);
const escapedKey = String.raw`"permis\u0073ions"`;
const escapedKeyBypass = workflow.replace(
	jobPermissionBlock,
	`${scalarDecoy}\n    ${escapedKey}: write-all`,
);
const escapedDuplicate = workflow.replace(
	jobPermissionBlock,
	`${jobPermissionBlock}\n    ${escapedKey}: write-all`,
);

for (const [name, source] of [
	["explicit key", explicitKeyBypass],
	["escaped key", escapedKeyBypass],
]) {
	test(`parser rejects the exact reported ${name} decoy as malformed YAML`, () => {
		const document = parseDocument(source, {
			version: "1.2",
			schema: "core",
			uniqueKeys: true,
		});
		assert.ok(document.errors.some(({ code }) => code === "MISSING_CHAR"));
		assert.notDeepEqual(inspectWorkflowPermissions(source), []);
	});
	test(`parser identifies write-all behind a valid multiline ${name} decoy`, () => {
		// YAML 1.2 requires continuation lines to be indented inside the scalar.
		const validSource = source.replace(
			scalarDecoy,
			'    name: "Permission check\n      permissions:\n        contents: read\n      "',
		);
		const document = parseDocument(validSource, {
			version: "1.2",
			schema: "core",
			uniqueKeys: true,
		});
		assert.deepEqual(document.errors, []);
		assert.deepEqual(document.warnings, []);
		assert.equal(
			document.getIn(["jobs", "contrast", "permissions"]),
			"write-all",
		);
		assert.match(
			document.getIn(["jobs", "contrast", "name"]),
			/permissions: contents: read/,
		);
		assert.notDeepEqual(inspectWorkflowPermissions(validSource), []);
	});
}

test("parser rejects duplicate permission keys after escape decoding", () => {
	const document = parseDocument(escapedDuplicate, {
		version: "1.2",
		schema: "core",
		uniqueKeys: true,
	});
	assert.ok(document.errors.some(({ code }) => code === "DUPLICATE_KEY"));
	assert.notDeepEqual(inspectWorkflowPermissions(escapedDuplicate), []);
});

test("YAML 1.2 preserves the GitHub on key as a string", () => {
	const document = parseDocument(workflow, { version: "1.2", schema: "core" });
	assert.ok(isMap(document.get("on", true)));
	assert.equal(document.has(true), false);
	assert.deepEqual(inspectWorkflowPermissions(workflow), []);
});

const yamlUnsafeWorkflows = new Map([
	["multiline name and explicit permission key", explicitKeyBypass],
	["multiline name and escaped permission key", escapedKeyBypass],
	["escaped duplicate permission key", escapedDuplicate],
	["duplicate decoded jobs key", `${workflow}\n"jo\\u0062s": {}\n`],
	["duplicate decoded contrast key", `${workflow}\n  "con\\u0074rast": {}\n`],
	["multiple YAML documents", `${workflow}\n---\npermissions: write-all\n`],
	["malformed YAML", `${workflow}\nbroken: [\n`],
	["sequence document root", "- permissions: {}\n- jobs: {}\n"],
	["empty YAML document", ""],
	["unsupported YAML 1.1 directive", `%YAML 1.1\n---\n${workflow}`],
	["unsupported YAML version directive", `%YAML 1.3\n---\n${workflow}`],
	["unknown directive warning", `%UNKNOWN example\n---\n${workflow}`],
	["anchored root mapping", `&workflow\n${workflow}`],
	["unused scalar anchor", `${workflow}\nnote: &note safe\n`],
	["alias", `${workflow}\nnote: *missing\n`],
	["merge key", `${workflow}\n<<: { permissions: {} }\n`],
	["custom scalar tag", `${workflow}\nnote: !custom safe\n`],
	[
		"custom mapping tag",
		workflow.replace("permissions: {}", "permissions: !custom {}"),
	],
	["complex sequence key", `${workflow}\n? [permissions]\n: write-all\n`],
	["complex mapping key", `${workflow}\n? {permissions: read}\n: write-all\n`],
	["non-string mapping key", `${workflow}\ntrue: safe\n`],
	[
		"quoted scalar substituting for job permissions",
		workflow.replace(jobPermissionBlock, scalarDecoy),
	],
	[
		"block scalar substituting for job permissions",
		workflow.replace(
			jobPermissionBlock,
			"    name: |\n      permissions:\n        contents: read",
		),
	],
	[
		"block scalar substituting for root permissions",
		workflow.replace("permissions: {}", "name: |\n  permissions: {}"),
	],
	["missing root permissions", workflow.replace("permissions: {}\n", "")],
	[
		"null jobs",
		workflow.replace("jobs:\n  contrast:", "jobs: null\nother:\n  contrast:"),
	],
	[
		"sequence jobs",
		workflow.replace("jobs:\n  contrast:", "jobs:\n  - contrast:"),
	],
	["scalar contrast job", "permissions: {}\njobs:\n  contrast: read\n"],
	["sequence contrast job", "permissions: {}\njobs:\n  contrast: []\n"],
]);
for (const [name, value] of [
	["null", "null"],
	["implicit null", ""],
	["scalar", "read"],
	["sequence", "[contents, read]"],
]) {
	yamlUnsafeWorkflows.set(
		`${name} root permissions`,
		workflow.replace("permissions: {}", `permissions: ${value}`),
	);
	yamlUnsafeWorkflows.set(
		`${name} job permissions`,
		workflow.replace(jobPermissionBlock, `    permissions: ${value}`),
	);
}
for (const [name, source] of yamlUnsafeWorkflows) {
	test(`rejects YAML ${name}`, () => {
		assert.notDeepEqual(
			inspectWorkflowPermissions(source),
			[],
			`unsafe YAML accepted: ${name}`,
		);
	});
}

const harmlessWorkflows = new Map([
	["permission-like comment", `${workflow}\n# permissions: write-all\n`],
	[
		"permission-like string",
		workflow.replace("name: Docs Contrast", 'name: "permissions: write-all"'),
	],
	[
		"permission-like multiline string",
		workflow.replace(
			"    runs-on:",
			`    name: "permissions:\n      contents: write"\n    runs-on:`,
		),
	],
	[
		"permission-like block scalar",
		workflow.replace(
			"    runs-on:",
			"    name: |\n      permissions:\n        contents: write\n    runs-on:",
		),
	],
	[
		"quoted and escaped keys",
		workflow.replace(
			jobPermissionBlock,
			`    ${escapedKey}:\n      "contents": "read"`,
		),
	],
	[
		"explicit safe key",
		workflow.replace(
			jobPermissionBlock,
			"    ? permissions\n    :\n      contents: read",
		),
	],
	["explicit YAML 1.2 directive", `%YAML 1.2\n---\n${workflow}`],
]);
for (const [name, source] of harmlessWorkflows) {
	test(`accepts harmless YAML ${name}`, () => {
		assert.deepEqual(inspectWorkflowPermissions(source), []);
	});
}

const deployment = fs.readFileSync(
	path.resolve(siteRoot, "../../.github/workflows/docs-deploy.yml"),
	"utf8",
);
test("accepts both complete documentation workflow contracts", () => {
	assert.deepEqual(inspectDocumentationWorkflow(workflow), []);
	assert.deepEqual(inspectDocumentationWorkflow(deployment, "deploy"), []);
});
const deploymentMutations = new Map([
	[
		"ignored build failure",
		(d) => d.setIn(["jobs", "build", "continue-on-error"], true),
	],
	[
		"ignored deployment failure",
		(d) => d.setIn(["jobs", "deploy", "continue-on-error"], true),
	],
	["missing root permissions", (d) => d.delete("permissions")],
	["root write-all", (d) => d.set("permissions", "write-all")],
	[
		"privileged build",
		(d) => d.setIn(["jobs", "build", "permissions"], { contents: "write" }),
	],
	[
		"missing build permissions",
		(d) => d.deleteIn(["jobs", "build", "permissions"]),
	],
	[
		"missing deploy permissions",
		(d) => d.deleteIn(["jobs", "deploy", "permissions"]),
	],
	[
		"extra deploy permission",
		(d) => d.setIn(["jobs", "deploy", "permissions", "contents"], "write"),
	],
	[
		"missing OIDC permission",
		(d) => d.deleteIn(["jobs", "deploy", "permissions", "id-token"]),
	],
	[
		"missing Pages permission",
		(d) => d.deleteIn(["jobs", "deploy", "permissions", "pages"]),
	],
	["missing dependency", (d) => d.deleteIn(["jobs", "deploy", "needs"])],
	["other dependency", (d) => d.setIn(["jobs", "deploy", "needs"], "other")],
	["missing environment", (d) => d.deleteIn(["jobs", "deploy", "environment"])],
	[
		"other environment",
		(d) => d.setIn(["jobs", "deploy", "environment", "name"], "other"),
	],
	["missing branch condition", (d) => d.deleteIn(["jobs", "deploy", "if"])],
	[
		"failure-bypassing condition",
		(d) =>
			d.setIn(
				["jobs", "deploy", "if"],
				"always() && github.ref == 'refs/heads/main'",
			),
	],
	[
		"other branch condition",
		(d) => d.setIn(["jobs", "deploy", "if"], "github.ref == 'refs/heads/beta'"),
	],
	["unexpected job", (d) => d.setIn(["jobs", "extra"], {})],
	["pull_request_target", (d) => d.setIn(["on", "pull_request_target"], {})],
	["other push branch", (d) => d.setIn(["on", "push", "branches"], ["beta"])],
	["missing manual trigger", (d) => d.deleteIn(["on", "workflow_dispatch"])],
	[
		"npm credentials",
		(d) =>
			d.setIn(["jobs", "build", "env"], {
				NPM_TOKEN: "$" + "{{ secrets.NPM_TOKEN }}",
			}),
	],
	[
		"secret in action input",
		(d) =>
			d.setIn(["jobs", "build", "steps", 0, "with"], {
				token: "$" + "{{ secrets.WRITE_TOKEN }}",
			}),
	],
	[
		"unpinned pnpm",
		(d) => d.setIn(["jobs", "build", "steps", 1, "with", "version"], 9),
	],
	[
		"missing publication validation",
		(d) => {
			const steps = d.getIn(["jobs", "build", "steps"]);
			steps.items = steps.items.filter(
				(s) => s.get("run") !== "pnpm --filter docs-site run check:publication",
			);
		},
	],
	[
		"wrong Pages artifact path",
		(d) => {
			const upload = d
				.getIn(["jobs", "build", "steps"])
				.items.find((s) =>
					s.get("uses")?.startsWith("actions/upload-pages-artifact@"),
				);
			upload.setIn(["with", "path"], "other");
		},
	],
	["missing Pages deployment", (d) => d.setIn(["jobs", "deploy", "steps"], [])],
	[
		"wrong URL wiring",
		(d) =>
			d.setIn(
				["jobs", "deploy", "environment", "url"],
				"https://example.invalid",
			),
	],
]);
for (const command of [
	"npm publish",
	"pnpm publish",
	"npm stage approve fake",
	"npm dist-tag add pkg latest",
	"git push origin main",
	"gh release create fake",
]) {
	deploymentMutations.set(`executable ${command}`, (d) =>
		d.getIn(["jobs", "build", "steps"]).add({ name: "fixture", run: command }),
	);
}
for (const [name, mutate] of deploymentMutations) {
	test(`deployment policy rejects ${name} in valid YAML`, () => {
		const document = parseDocument(deployment);
		mutate(document);
		const source = document.toString();
		assert.deepEqual(parseDocument(source).errors, []);
		assert.notDeepEqual(inspectDocumentationWorkflow(source, "deploy"), []);
	});
}
for (const [name, mutation] of [
	[
		"duplicate key",
		(s) => s.replace("permissions: {}", "permissions: {}\npermissions: {}"),
	],
	[
		"escaped duplicate key",
		(s) =>
			s.replace("permissions: {}", 'permissions: {}\n"permis\\u0073ions": {}'),
	],
	["malformed document", (s) => `${s}\nbroken: [\n`],
]) {
	test(`deployment parser rejects ${name}`, () => {
		const source = mutation(deployment);
		assert.ok(parseDocument(source).errors.length > 0);
		assert.ok(
			inspectDocumentationWorkflow(source, "deploy").some((p) =>
				p.startsWith("YAML "),
			),
		);
	});
}
for (const [name, mutation] of [
	["alias", (s) => `${s}\nnote: *missing\n`],
	["anchor", (s) => `${s}\nnote: &unused safe\n`],
	["merge", (s) => `${s}\n<<: { permissions: {} }\n`],
	["multiple documents", (s) => `${s}\n---\n{}\n`],
	["custom tag", (s) => `${s}\nnote: !custom safe\n`],
	[
		"multiline decoy",
		(s) =>
			s.replace(
				"    permissions:\n      contents: read",
				'    name: "permissions:\n      contents: read"\n    "permis\\u0073ions": write-all',
			),
	],
]) {
	test(`deployment structural policy rejects ${name}`, () =>
		assert.notDeepEqual(
			inspectDocumentationWorkflow(mutation(deployment), "deploy"),
			[],
		));
}
for (const kind of ["contrast", "deploy"]) {
	for (const [name, value] of [
		["multiline", "run: npm publish\npermissions: write-all\nNPM_TOKEN"],
		["plain", "git push is prohibited"],
	]) {
		test(
			kind +
				" accepts descriptive " +
				name +
				" text without treating it as executable",
			() => {
				const doc = parseDocument(kind === "contrast" ? workflow : deployment);
				doc.set("name", value);
				const job = kind === "contrast" ? "contrast" : "build";
				doc.setIn(["jobs", job, "steps", 0, "name"], value);
				assert.deepEqual(
					inspectDocumentationWorkflow(doc.toString(), kind),
					[],
				);
			},
		);
	}
}
test("deployment accepts decoded escaped permission keys", () => {
	assert.deepEqual(
		inspectDocumentationWorkflow(
			deployment.replace("permissions: {}", '"permis\\u0073ions": {}'),
			"deploy",
		),
		[],
	);
});

test("actual CI browser command propagates test failure and success", () =>
	withSite(({ root, site }) => {
		const data = parseDocument(workflow).toJS();
		const steps = data.jobs.contrast.steps;
		const index = steps.findIndex(
			(s) => s.run === "pnpm --filter docs-site run test:browser-audits",
		);
		assert.ok(
			index > steps.findIndex((s) => s.run === "pnpm --filter docs-site build"),
		);
		assert.ok(
			index > steps.findIndex((s) => s.run?.includes("playwright install")),
		);
		assert.equal(steps[index]["continue-on-error"], undefined);
		assert.equal(steps[index].if, undefined);
		assert.equal(
			steps.filter((s) => s.run?.includes("check:publication")).length,
			1,
		);
		assert.equal(
			steps.filter((s) => s.run === "pnpm --filter docs-site build").length,
			1,
		);
		for (const script of ["check:contrast", "check:accessibility"])
			assert.ok(
				steps.some((s) => s.run === `pnpm --filter docs-site run ${script}`),
			);
		fs.copyFileSync(
			path.resolve(siteRoot, "../../pnpm-workspace.yaml"),
			path.join(root, "pnpm-workspace.yaml"),
		);
		for (const failure of [true, false]) {
			fs.writeFileSync(
				path.join(site, "scripts/browser-audits.test.mjs"),
				"import test from 'node:test'; test('CI propagation fixture', () => { " +
					(failure
						? "throw new Error('intentional browser-lane failure');"
						: "") +
					" });\n",
			);
			const [command, ...args] = steps[index].run.split(" ");
			// This is a fresh CI process, not a recursive node:test child.
			const env = { ...process.env };
			delete env.NODE_TEST_CONTEXT;
			const result = spawnSync(command, args, {
				cwd: root,
				env,
				encoding: "utf8",
				timeout: 30000,
			});
			const output = result.stdout + result.stderr;
			assert.match(output, /CI propagation fixture/);
			assert.match(output, /# tests 1/);
			assert.equal(result.status === 0, !failure, output);
		}
	}));
