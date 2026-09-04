import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
