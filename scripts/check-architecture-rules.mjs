#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const configPath = path.join(root, ".fas-config.json");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const importPattern =
	/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePath(filePath) {
	return filePath.split(path.sep).join("/");
}

function relativePath(filePath) {
	return normalizePath(path.relative(root, filePath));
}

function resolveWorkspacePackages() {
	const packagesDir = path.join(root, "packages");
	if (!fs.existsSync(packagesDir)) {
		return new Map();
	}

	const packages = new Map();
	for (const packageDirName of fs.readdirSync(packagesDir)) {
		const packageDir = path.join(packagesDir, packageDirName);
		const packageJsonPath = path.join(packageDir, "package.json");
		if (!fs.existsSync(packageJsonPath)) {
			continue;
		}

		const packageJson = readJson(packageJsonPath);
		if (typeof packageJson.name === "string") {
			packages.set(packageJson.name, packageDir);
		}
	}
	return packages;
}

function isSourceFile(filePath) {
	return sourceExtensions.includes(path.extname(filePath));
}

function listSourceFiles(entryPath) {
	if (!fs.existsSync(entryPath)) {
		return [];
	}

	const stat = fs.statSync(entryPath);
	if (stat.isFile()) {
		return isSourceFile(entryPath) ? [entryPath] : [];
	}

	const files = [];
	for (const child of fs.readdirSync(entryPath)) {
		if (child === "node_modules" || child === "dist" || child === "coverage") {
			continue;
		}
		files.push(...listSourceFiles(path.join(entryPath, child)));
	}
	return files;
}

function resolveFileCandidate(basePath) {
	if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
		return basePath;
	}

	for (const extension of sourceExtensions) {
		const filePath = `${basePath}${extension}`;
		if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
			return filePath;
		}
	}

	if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
		for (const extension of sourceExtensions) {
			const indexPath = path.join(basePath, `index${extension}`);
			if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
				return indexPath;
			}
		}
	}

	return null;
}

function resolveImport(specifier, fromFile, workspacePackages) {
	if (specifier.startsWith(".")) {
		return resolveFileCandidate(
			path.resolve(path.dirname(fromFile), specifier),
		);
	}

	for (const [packageName, packageDir] of workspacePackages) {
		if (specifier === packageName) {
			return resolveFileCandidate(path.join(packageDir, "src", "index"));
		}

		const packagePrefix = `${packageName}/`;
		if (specifier.startsWith(packagePrefix)) {
			const subpath = specifier.slice(packagePrefix.length);
			return resolveFileCandidate(path.join(packageDir, "src", subpath));
		}
	}

	return null;
}

function validateConfiguredPaths(config) {
	const missingPaths = [];
	const boundaries = config.behaviorBoundaries ?? {};

	for (const [boundaryName, entries] of Object.entries(boundaries)) {
		if (!Array.isArray(entries)) {
			continue;
		}

		for (const entry of entries) {
			if (typeof entry !== "string") {
				continue;
			}
			const entryPath = path.join(root, entry);
			if (!fs.existsSync(entryPath)) {
				missingPaths.push(`${boundaryName}: ${entry}`);
			}
		}
	}

	return missingPaths;
}

function readImports(filePath) {
	const source = fs.readFileSync(filePath, "utf8");
	const imports = [];
	let match = importPattern.exec(source);

	while (match) {
		imports.push(match[1] ?? match[2] ?? match[3]);
		match = importPattern.exec(source);
	}

	return imports;
}

function checkRules(rulesFilePath, workspacePackages) {
	const rulesDocument = readJson(rulesFilePath);
	const rules = rulesDocument.rules;
	if (!Array.isArray(rules)) {
		throw new Error(
			`${relativePath(rulesFilePath)} must contain a rules array.`,
		);
	}

	const violations = [];
	for (const rule of rules) {
		const from = path.join(root, rule.from);
		const forbidden = normalizePath(rule.cannotImport).replace(/\/$/, "");

		if (!fs.existsSync(from)) {
			violations.push(`${rule.name}: from path does not exist: ${rule.from}`);
			continue;
		}

		for (const sourceFile of listSourceFiles(from)) {
			for (const specifier of readImports(sourceFile)) {
				const resolved = resolveImport(
					specifier,
					sourceFile,
					workspacePackages,
				);
				if (!resolved) {
					continue;
				}

				const resolvedRelative = relativePath(resolved);
				if (
					resolvedRelative === forbidden ||
					resolvedRelative.startsWith(`${forbidden}/`)
				) {
					violations.push(
						`${rule.name}: ${relativePath(sourceFile)} imports ${specifier} -> ${resolvedRelative}`,
					);
				}
			}
		}
	}

	return violations;
}

if (!fs.existsSync(configPath)) {
	console.error("Missing .fas-config.json.");
	process.exit(1);
}

const config = readJson(configPath);
if (typeof config.architectureRulesFile !== "string") {
	console.error(".fas-config.json must define architectureRulesFile.");
	process.exit(1);
}

const architectureRulesPath = path.join(root, config.architectureRulesFile);
if (!fs.existsSync(architectureRulesPath)) {
	console.error(
		`Architecture rules file is configured but missing: ${config.architectureRulesFile}`,
	);
	process.exit(1);
}

const missingBoundaryPaths = validateConfiguredPaths(config);
const ruleViolations = checkRules(
	architectureRulesPath,
	resolveWorkspacePackages(),
);
const failures = [...missingBoundaryPaths, ...ruleViolations];

if (failures.length > 0) {
	console.error("Architecture boundary check failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("Architecture boundary check passed.");
