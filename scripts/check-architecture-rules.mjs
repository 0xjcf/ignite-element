#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const importPattern =
	/(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizePath(filePath) {
	return filePath.split(path.sep).join("/");
}

function relativePath(root, filePath) {
	return normalizePath(path.relative(root, filePath));
}

function resolveWorkspacePackages(root) {
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

function getRealPath(filePath) {
	return typeof fs.realpathSync.native === "function"
		? fs.realpathSync.native(filePath)
		: fs.realpathSync(filePath);
}

export function listSourceFiles(
	entryPath,
	visitedDirectories = new Set(),
	followEntrySymlink = true,
) {
	if (!fs.existsSync(entryPath)) {
		return [];
	}

	const entryStats = fs.lstatSync(entryPath);
	if (entryStats.isSymbolicLink()) {
		if (!followEntrySymlink) {
			return [];
		}
		return listSourceFiles(getRealPath(entryPath), visitedDirectories, false);
	}

	if (entryStats.isFile()) {
		return isSourceFile(entryPath) ? [entryPath] : [];
	}

	if (!entryStats.isDirectory()) {
		return [];
	}

	const realEntryPath = getRealPath(entryPath);
	if (visitedDirectories.has(realEntryPath)) {
		return [];
	}
	visitedDirectories.add(realEntryPath);

	const files = [];
	for (const child of fs.readdirSync(entryPath, { withFileTypes: true })) {
		if (
			child.name === "node_modules" ||
			child.name === "dist" ||
			child.name === "coverage"
		) {
			continue;
		}
		if (child.isSymbolicLink()) {
			continue;
		}
		files.push(
			...listSourceFiles(
				path.join(entryPath, child.name),
				visitedDirectories,
				false,
			),
		);
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

export function validateConfiguredPaths(root, config) {
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

export function checkRules(root, rulesFilePath, workspacePackages) {
	const rulesDocument = readJson(rulesFilePath);
	const rules = rulesDocument.rules;
	if (!Array.isArray(rules)) {
		throw new Error(
			`${relativePath(root, rulesFilePath)} must contain a rules array.`,
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
					if (
						specifier === forbidden ||
						specifier.startsWith(`${forbidden}/`)
					) {
						violations.push(
							`${rule.name}: ${relativePath(root, sourceFile)} imports ${specifier} -> ${specifier}`,
						);
					}
					continue;
				}

				const resolvedRelative = relativePath(root, resolved);
				if (
					resolvedRelative === forbidden ||
					resolvedRelative.startsWith(`${forbidden}/`)
				) {
					violations.push(
						`${rule.name}: ${relativePath(root, sourceFile)} imports ${specifier} -> ${resolvedRelative}`,
					);
				}
			}
		}
	}

	return violations;
}

export function runCli(cwd = process.cwd()) {
	const configPath = path.join(cwd, ".fas-config.json");
	if (!fs.existsSync(configPath)) {
		throw new Error("Missing .fas-config.json.");
	}

	const config = readJson(configPath);
	if (typeof config.architectureRulesFile !== "string") {
		throw new Error(".fas-config.json must define architectureRulesFile.");
	}

	const architectureRulesPath = path.join(cwd, config.architectureRulesFile);
	if (!fs.existsSync(architectureRulesPath)) {
		throw new Error(
			`Architecture rules file is configured but missing: ${config.architectureRulesFile}`,
		);
	}

	const missingBoundaryPaths = validateConfiguredPaths(cwd, config);
	const ruleViolations = checkRules(
		cwd,
		architectureRulesPath,
		resolveWorkspacePackages(cwd),
	);
	const failures = [...missingBoundaryPaths, ...ruleViolations];

	if (failures.length > 0) {
		process.stderr.write("Architecture boundary check failed:\n");
		for (const failure of failures) {
			process.stderr.write(`- ${failure}\n`);
		}
		process.exitCode = 1;
		return;
	}

	process.stdout.write("Architecture boundary check passed.\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		runCli();
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
