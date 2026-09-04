import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const repoRoot = path.resolve(siteRoot, "..", "..");
const docsRoot = path.join(siteRoot, "src/content/docs");
const archiveRoot = path.join(docsRoot, "2.x");
const workflowPath = path.join(repoRoot, ".github/workflows/docs-contrast.yml");
const validatorPath = path.join(siteRoot, "scripts/check-doc-examples.mjs");

const TS_LANGUAGES = new Set(["ts", "tsx", "typescript", "typescriptreact"]);
const SKIP_META = /\b(no-check|no-typecheck|docs-skip)\b/;
const SKIP_COMMENT = /^\s*\/\/\s*docs-check:\s*skip\b/;
const ARCHIVE = /(^|\/)\d+\.x(\/|$)/;
const INSTALL_COMMAND =
	/\b(?:pnpm\s+add|npm\s+(?:install|i)|yarn\s+add|bun\s+add)\b([^\n`]*)/g;
const FACADE_PACKAGE = /(?:^|\s)(ignite-element(?:@[^\s#,'"]+)?)/g;

function walk(directory) {
	const result = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...walk(absolute));
		else if (/\.mdx?$/.test(entry.name)) result.push(absolute);
	}
	return result.sort();
}

function extractTypeScriptBlocks(text) {
	const lines = text.split("\n");
	const blocks = [];
	let current;
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		if (current) {
			if (/^```\s*$/.test(lines[lineIndex])) {
				blocks.push({ ...current, code: current.code.join("\n") });
				current = undefined;
			} else {
				current.code.push(lines[lineIndex]);
			}
			continue;
		}
		const fence = lines[lineIndex].match(/^```([A-Za-z0-9]+)?[ \t]*(.*)$/);
		if (fence) {
			current = {
				language: (fence[1] || "").toLowerCase(),
				meta: fence[2] || "",
				code: [],
				line: lineIndex + 2,
			};
		}
	}
	return blocks.filter((block) => TS_LANGUAGES.has(block.language));
}

function exclusionMechanism(block) {
	const metaMatch = block.meta.match(SKIP_META);
	if (metaMatch) return metaMatch[1];
	const firstLine = block.code.split("\n").find((line) => line.trim());
	if (firstLine && SKIP_COMMENT.test(firstLine)) return "skip-comment";
	return undefined;
}

function inspectCurrentDocs() {
	const files = walk(docsRoot).filter((file) => {
		const relative = path.relative(docsRoot, file).split(path.sep).join("/");
		return !ARCHIVE.test(relative);
	});
	const exclusions = [];
	let total = 0;
	for (const file of files) {
		const blocks = extractTypeScriptBlocks(fs.readFileSync(file, "utf8"));
		total += blocks.length;
		for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
			const block = blocks[blockIndex];
			const mechanism = exclusionMechanism(block);
			if (!mechanism) continue;
			exclusions.push({
				doc: path.relative(repoRoot, file).split(path.sep).join("/"),
				blockIndex: blockIndex + 1,
				line: block.line,
				language: block.language,
				mechanism,
			});
		}
	}
	return { files: files.length, total, exclusions };
}

function inspectV2Installs() {
	const violations = [];
	for (const file of walk(archiveRoot)) {
		const relative = path.relative(repoRoot, file).split(path.sep).join("/");
		const lines = fs.readFileSync(file, "utf8").split("\n");
		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			for (const command of lines[lineIndex].matchAll(INSTALL_COMMAND)) {
				for (const facade of command[1].matchAll(FACADE_PACKAGE)) {
					if (facade[1] !== "ignite-element@2.2.2") {
						violations.push({
							doc: relative,
							line: lineIndex + 1,
							package: facade[1],
						});
					}
				}
			}
		}
	}
	return violations;
}

export function inspectWorkflowPermissions(workflow) {
	const problems = [];
	if (!/^permissions:\s*\{\}\s*$/m.test(workflow)) {
		problems.push("top-level permissions are not explicitly empty");
	}
	if (!/^\s{4}permissions:\s*\n\s{6}contents:\s*read\s*$/m.test(workflow)) {
		problems.push("contrast job does not grant only contents: read");
	}
	if (/\b(?:write|id-token|pages|packages|deployments):/i.test(workflow)) {
		problems.push("workflow contains write, OIDC, Pages, or package authority");
	}
	return problems;
}

function inspectWorkflow() {
	const workflow = fs.readFileSync(workflowPath, "utf8");
	const rootPackage = JSON.parse(
		fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
	);
	const packageManager =
		rootPackage.packageManager ?? rootPackage.devEngines?.packageManager;
	const problems = inspectWorkflowPermissions(workflow);
	if (
		!/uses:\s*pnpm\/action-setup@v4[\s\S]{0,240}\bversion:\s*9\.15\.9\b/.test(
			workflow,
		)
	) {
		problems.push(
			`pnpm/action-setup has no explicit 9.15.9 input and root fallback is ${packageManager ?? "absent"}`,
		);
	}
	if (/pull_request_target\s*:/.test(workflow)) {
		problems.push("pull_request_target is prohibited");
	}
	if (/\$\{\{\s*secrets\.|NPM_TOKEN|NODE_AUTH_TOKEN/.test(workflow)) {
		problems.push("workflow references a secret or npm credential");
	}
	for (const required of [
		"pull_request:",
		"branches: [main]",
		'"docs/site/**"',
		'"packages/**"',
		'".github/workflows/docs-contrast.yml"',
		"workflow_dispatch:",
	]) {
		if (!workflow.includes(required)) {
			problems.push(`workflow trigger/filter changed: missing ${required}`);
		}
	}
	if (
		/\brun:\s*.*\b(?:git\s+push|npm\s+publish|pnpm\s+publish|gh\s+|deploy)\b/i.test(
			workflow,
		)
	) {
		problems.push(
			"workflow contains a repository or publication mutation command",
		);
	}
	return problems;
}

function runExampleValidator() {
	const result = spawnSync(process.execPath, [validatorPath], {
		cwd: siteRoot,
		encoding: "utf8",
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	let report;
	for (const line of output.split("\n")) {
		try {
			const parsed = JSON.parse(line);
			if (parsed.status === "documentation-example-accounting") report = parsed;
		} catch {
			// Human-readable validator output is intentionally ignored here.
		}
	}
	return { status: result.status, output, report };
}

function main() {
	const failures = [];
	const workflowProblems = inspectWorkflow();
	for (const problem of workflowProblems) failures.push(`workflow: ${problem}`);

	const v2Violations = inspectV2Installs();
	for (const violation of v2Violations) {
		failures.push(
			`v2 install: ${violation.doc}:${violation.line} selects ${violation.package}`,
		);
	}

	const discovered = inspectCurrentDocs();
	const eligible = discovered.total - discovered.exclusions.length;
	const validator = runExampleValidator();
	if (validator.status !== 0) {
		failures.push(
			`example validator exited ${validator.status}\n${validator.output.trim()}`,
		);
	} else if (!validator.report) {
		failures.push(
			`example accounting: validator omits ${discovered.exclusions.length} explicit exclusions and reports no complete accounting record`,
		);
	} else {
		const expected = {
			filesScanned: discovered.files,
			totalDiscovered: discovered.total,
			explicitlyExcluded: discovered.exclusions.length,
			eligible,
		};
		for (const [field, value] of Object.entries(expected)) {
			if (validator.report[field] !== value) {
				failures.push(
					`example accounting: ${field} is ${validator.report[field]}, expected discovered value ${value}`,
				);
			}
		}
		if (
			validator.report.totalDiscovered !==
			validator.report.explicitlyExcluded +
				validator.report.syntacticallyIncomplete +
				validator.report.actuallyTypechecked
		) {
			failures.push(
				"example accounting: total partition invariant is not proved",
			);
		}
		if (
			validator.report.eligible !==
			validator.report.syntacticallyIncomplete +
				validator.report.actuallyTypechecked
		) {
			failures.push(
				"example accounting: eligible partition invariant is not proved",
			);
		}
		if (
			JSON.stringify(validator.report.exclusions) !==
			JSON.stringify(discovered.exclusions)
		) {
			failures.push(
				"example accounting: explicit-exclusion inventory is incomplete",
			);
		}
	}

	console.log(
		JSON.stringify({
			status: failures.length
				? "failed-docs-publication-contract"
				: "verified-docs-publication-contract",
			workflowProblems: workflowProblems.length,
			v2InstallViolations: v2Violations.length,
			filesScanned: discovered.files,
			totalDiscovered: discovered.total,
			explicitlyExcluded: discovered.exclusions.length,
			eligible,
			validatorReportedCompleteAccounting: Boolean(validator.report),
		}),
	);

	if (failures.length) {
		for (const failure of failures) console.error(`- ${failure}`);
		process.exit(1);
	}
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
	main();
