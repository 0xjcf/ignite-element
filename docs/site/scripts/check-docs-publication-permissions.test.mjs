import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isMap, parseDocument } from "yaml";

import { inspectWorkflowPermissions } from "./check-docs-publication-contract.mjs";

const siteRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const workflow = fs.readFileSync(
	path.resolve(siteRoot, "../../.github/workflows/docs-contrast.yml"),
	"utf8",
);

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
