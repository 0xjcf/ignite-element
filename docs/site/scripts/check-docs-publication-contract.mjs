import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAlias, isMap, isScalar, parseAllDocuments, visit } from "yaml";

const siteRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const repoRoot = path.resolve(siteRoot, "..", "..");
const docsRoot = path.join(siteRoot, "src/content/docs");
const archiveRoot = path.join(docsRoot, "2.x");

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

function parseWorkflow(workflow) {
	// YAML 1.2 core keeps GitHub's "on" key a string. Inspect nodes before any
	// conversion to objects so aliases and decoded duplicate keys cannot hide.
	const documents = parseAllDocuments(workflow, {
		version: "1.2",
		schema: "core",
		strict: true,
		uniqueKeys: true,
		merge: false,
		customTags: [],
		resolveKnownTags: false,
		keepSourceTokens: true,
	});
	if (documents.length !== 1)
		return { problems: ["workflow must contain exactly one YAML document"] };
	const document = documents[0];
	const problems = [...document.errors, ...document.warnings].map(
		({ code, message }) => `YAML ${code}: ${message}`,
	);
	if (document.directives?.yaml.version !== "1.2") {
		problems.push("workflow must use YAML 1.2");
	}
	if (problems.length) return { problems };
	if (!isMap(document.contents))
		return { problems: ["workflow root must be a mapping"] };

	visit(document, {
		Node(_key, node) {
			if (isAlias(node)) problems.push("YAML aliases are unsupported");
			if (node.anchor) problems.push("YAML anchors are unsupported");
			if (node.tag && !node.tag.startsWith("tag:yaml.org,2002:")) {
				problems.push("custom YAML tags are unsupported");
			}
		},
		Pair(_key, pair) {
			if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
				problems.push("YAML mapping keys must be scalar strings");
			} else if (pair.key.value === "<<") {
				problems.push("YAML merge keys are unsupported");
			}
		},
	});
	if (problems.length) return { problems: [...new Set(problems)] };

	return { root: document.contents, problems: [] };
}

export function inspectWorkflowPermissions(workflow) {
	const parsed = parseWorkflow(workflow);
	return parsed.problems.length
		? parsed.problems
		: inspectPermissions(parsed.root, "contrast");
}

function inspectPermissions(root, kind) {
	const problems = [];
	if (kind === "deploy") {
		const data = root.toJSON();
		const exact = (actual, expected) =>
			actual &&
			typeof actual === "object" &&
			!Array.isArray(actual) &&
			Object.keys(actual).length === Object.keys(expected).length &&
			Object.entries(expected).every(([key, value]) => actual[key] === value);
		if (!exact(data.permissions, {}))
			problems.push("top-level permissions must be an explicit empty mapping");
		if (
			!data.jobs ||
			Object.keys(data.jobs).sort().join(",") !== "build,deploy"
		)
			problems.push("jobs must contain only build and deploy");
		if (!exact(data.jobs?.build?.permissions, { contents: "read" }))
			problems.push("build permissions must contain only contents: read");
		if (
			!exact(data.jobs?.deploy?.permissions, {
				pages: "write",
				"id-token": "write",
			})
		)
			problems.push(
				"deploy permissions must contain only pages: write and id-token: write",
			);
		return problems;
	}
	const rootPermissions = root.get("permissions", true);
	if (!isMap(rootPermissions) || rootPermissions.items.length !== 0) {
		problems.push("top-level permissions must be an explicit empty mapping");
	}
	const jobs = root.get("jobs", true);
	if (
		!isMap(jobs) ||
		jobs.items.length !== 1 ||
		jobs.items[0].key.value !== "contrast"
	) {
		problems.push("jobs must be a mapping containing only contrast");
		return problems;
	}
	const contrast = jobs.get("contrast", true);
	if (!isMap(contrast)) {
		problems.push("contrast must be a job mapping");
		return problems;
	}
	const permissions = contrast.get("permissions", true);
	if (
		!isMap(permissions) ||
		permissions.flow ||
		permissions.items.length !== 1 ||
		permissions.items[0].key.value !== "contents" ||
		!isScalar(permissions.items[0].value) ||
		permissions.items[0].value.value !== "read"
	) {
		problems.push(
			"contrast permissions must be a block mapping containing only contents: read",
		);
	} else if (permissions.srcToken?.indent !== contrast.srcToken?.indent + 2) {
		// Preserve the existing two-space permission-map indentation contract,
		// using the parser's CST metadata rather than scanning workflow text.
		problems.push("contrast permission mapping must use two-space indentation");
	}
	return problems;
}

// Inspect GitHub expression tokens only. Single-quoted expression literals use
// doubled quotes; words inside them are data, not context references. This is
// deliberately not a general expression evaluator or shell-program analyzer.
function referencesSecrets(value) {
	let offset = 0;
	while (offset < value.length) {
		const start = value.indexOf("${{", offset);
		if (start === -1) break;
		offset = start + 3;
		let previous;
		while (offset < value.length && !value.startsWith("}}", offset)) {
			const character = value[offset];
			if (/\s/.test(character)) {
				offset++;
				continue;
			}
			if (character === "'") {
				offset++;
				while (offset < value.length) {
					if (value[offset++] !== "'") continue;
					if (value[offset] !== "'") break;
					offset++;
				}
				previous = "literal";
				continue;
			}
			const identifier = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(value.slice(offset));
			if (identifier) {
				if (identifier[0].toLowerCase() === "secrets" && previous !== ".")
					return true;
				previous = identifier[0];
				offset += identifier[0].length;
			} else {
				previous = character;
				offset++;
			}
		}
	}
	return false;
}

export function inspectDocumentationWorkflow(workflow, kind = "contrast") {
	const parsed = parseWorkflow(workflow);
	if (parsed.problems.length) return parsed.problems;
	const problems = inspectPermissions(parsed.root, kind);
	if (problems.length) return problems;
	const data = parsed.root.toJSON();
	const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
	const trigger = kind === "deploy" ? "push" : "pull_request";
	if (
		!data.on ||
		Object.keys(data.on).sort().join(",") !==
			[trigger, "workflow_dispatch"].sort().join(",") ||
		!same(data.on[trigger]?.branches, ["main"])
	) {
		problems.push(
			"workflow triggers must select main and allow manual dispatch; pull_request_target is prohibited",
		);
	}
	if (kind === "contrast") {
		for (const filter of [
			"docs/site/**",
			"packages/**",
			".github/workflows/docs-contrast.yml",
			".github/workflows/docs-deploy.yml",
		]) {
			if (!data.on?.pull_request?.paths?.includes(filter))
				problems.push(`missing PR path filter: ${filter}`);
		}
	}
	// These checks cover decoded executable fields, not descriptive names or
	// arbitrary shell programs. Do not claim general shell-program analysis.
	const inspectCredentials = (value) => {
		if (
			typeof value === "string" &&
			(referencesSecrets(value) || /NPM_TOKEN|NODE_AUTH_TOKEN/i.test(value))
		)
			problems.push("workflow references a secret or npm credential");
		if (value && typeof value === "object")
			for (const [key, child] of Object.entries(value)) {
				if (/NPM_TOKEN|NODE_AUTH_TOKEN/i.test(key))
					problems.push("workflow references an npm credential");
				inspectCredentials(child);
			}
	};
	inspectCredentials(data.env);
	for (const [name, job] of Object.entries(data.jobs)) {
		for (const field of ["env", "secrets", "with", "uses"])
			inspectCredentials(job[field]);
		if (!Array.isArray(job.steps)) {
			problems.push(`${name} steps must be a sequence`);
			continue;
		}
		for (const step of job.steps) {
			if (!step || typeof step !== "object" || Array.isArray(step)) {
				problems.push("workflow step must be a mapping");
				continue;
			}
			for (const field of ["run", "env", "with", "uses"])
				inspectCredentials(step[field]);
			if ("run" in step) {
				if (typeof step.run !== "string")
					problems.push("workflow run must be a string scalar");
				else if (
					/\b(?:git\s+push|(?:npm|pnpm)\s+(?:publish|stage|dist-tag|login|adduser)|gh\s+|deploy)\b/i.test(
						step.run,
					)
				)
					problems.push(
						"workflow contains a repository or publication mutation command",
					);
			}
		}
		if (
			name !== "deploy" &&
			!job.steps.some(
				(step) =>
					step?.uses === "pnpm/action-setup@v4" &&
					String(step.with?.version) === "9.15.9",
			)
		)
			problems.push(`${name} must pin pnpm/action-setup to 9.15.9`);
	}
	if (kind === "deploy") {
		const { build, deploy } = data.jobs;
		if (build["continue-on-error"] || deploy["continue-on-error"])
			problems.push("Pages jobs must not ignore failure");
		if (deploy.needs !== "build" && !same(deploy.needs, ["build"]))
			problems.push("deploy must depend on successful build");
		if (
			![
				"github.ref == 'refs/heads/main'",
				`\${{ github.ref == 'refs/heads/main' }}`,
			].includes(deploy.if)
		)
			problems.push(
				"deploy must use the explicit main-only condition with implicit success()",
			);
		if (deploy.environment?.name !== "github-pages")
			problems.push("deploy must use the github-pages environment");
		const steps = Array.isArray(build.steps) ? build.steps : [];
		const publication = steps.findIndex(
			(s) =>
				s?.run === "pnpm --filter docs-site run check:publication" &&
				!Object.hasOwn(s, "if") &&
				!s["continue-on-error"],
		);
		const built = steps.findIndex(
			(s) =>
				s?.run === "pnpm --filter docs-site build" &&
				!Object.hasOwn(s, "if") &&
				!s["continue-on-error"],
		);
		const uploads = steps.filter((s) =>
			s?.uses?.startsWith("actions/upload-pages-artifact@"),
		);
		const upload = steps.indexOf(uploads[0]);
		if (
			publication < 0 ||
			built < 0 ||
			upload <= publication ||
			upload <= built
		)
			problems.push(
				"build must validate publication and build before Pages artifact upload",
			);
		if (
			uploads.length !== 1 ||
			uploads[0].with?.path !== "docs/site/dist" ||
			(uploads[0].with?.name ?? "github-pages") !== "github-pages"
		)
			problems.push(
				"build must upload the existing github-pages artifact from docs/site/dist",
			);
		const deployments = Array.isArray(deploy.steps)
			? deploy.steps.filter((s) => s?.uses?.startsWith("actions/deploy-pages@"))
			: [];
		if (
			deployments.length !== 1 ||
			deployments[0].id !== "deployment" ||
			(deployments[0].with?.artifact_name ?? "github-pages") !==
				"github-pages" ||
			deploy.environment?.url !== `\${{ steps.deployment.outputs.page_url }}`
		)
			problems.push("deploy must retain the Pages artifact and URL wiring");
	}
	return [...new Set(problems)];
}

function inspectWorkflow() {
	return ["contrast", "deploy"].flatMap((kind) =>
		inspectDocumentationWorkflow(
			fs.readFileSync(
				path.join(repoRoot, `.github/workflows/docs-${kind}.yml`),
				"utf8",
			),
			kind,
		).map((problem) => `${kind}: ${problem}`),
	);
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
