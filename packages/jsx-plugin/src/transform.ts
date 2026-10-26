import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	realpathSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import generateModule from "@babel/generator";
import { type ParserPlugin, parse } from "@babel/parser";
import type { Binding, NodePath } from "@babel/traverse";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

/** Public name. The plugin rejects it. It is not inserted. */
export const AUTHOR_SOURCE = "ignite-element/jsx/author-style";
/** Private id inserted only by this plugin. Bundlers resolve it for that import alone. */
export const AUTHOR_VIRTUAL = "\0ignite-jsx:author-style";
/**
 * Babel and tsc emit this instead of a resolvable module. A build that has
 * no bundler plugin fails on the text, which is the whole error.
 */
export const AUTHOR_STANDALONE = `${AUTHOR_VIRTUAL} (not standalone and not enough on their own)`;
const RAW_SPECIFIER = /\.css\?raw(?:&|$)/;
const MARK_FILE =
	/(?:^|\/)(?:renderers\/jsx\/authorStyle(?:\.ts|\.js)?|author-style(?:-mark)?(?:\.development)?\.es\.js|jsx\/author-style(?:-mark)?)$/;

type Part = { type: "lit"; value: string } | { type: "ref"; name: string };

type Generate = typeof generateModule;
type Traverse = typeof traverseModule;

const generate =
	typeof generateModule === "function"
		? generateModule
		: (generateModule as unknown as { default: Generate }).default;
const traverse =
	typeof traverseModule === "function"
		? traverseModule
		: (traverseModule as unknown as { default: Traverse }).default;

export function isRawCssSpecifier(source: string): boolean {
	return RAW_SPECIFIER.test(source);
}

function unwrap(node: t.Node): t.Node {
	let current = node;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSNonNullExpression"
	) {
		current = current.expression;
	}
	return current;
}

function isStyleTag(name: t.JSXOpeningElement["name"]): boolean {
	if (name.type === "JSXIdentifier") return name.name === "style";
	if (name.type === "JSXNamespacedName") return name.name.name === "style";
	return false;
}

/**
 * JSX is enabled for JSX extensions, and for `.js` / `.mjs` / `.cjs` only when
 * that extension's bundler loader is JSX. `.ts`, `.mts`, and `.cts` stay
 * TypeScript so angle-bracket assertions still parse.
 * `decorators-legacy` matches this repo's `experimentalDecorators` setting.
 */
export function parserPluginsFor(
	filename: string,
	jsxScript: boolean,
): ParserPlugin[] {
	const file = filename.split("?")[0].split("\\").join("/");
	const plugins: ParserPlugin[] = ["decorators-legacy", "typescript"];
	if (/\.[cm]?[jt]sx$/.test(file) || (jsxScript && /\.[cm]?js$/.test(file))) {
		plugins.push("jsx");
	}
	return plugins;
}

/** Disk text may escape the leading NUL. Only the exact emitted import matches. */
export function isOfficialEmittedSpecifier(spec: string): boolean {
	if (spec === AUTHOR_VIRTUAL || spec === AUTHOR_STANDALONE) return true;
	const decoded = spec.replace(/\\u0000|\\x00|\\0/g, "\0");
	return decoded === AUTHOR_VIRTUAL || decoded === AUTHOR_STANDALONE;
}

function isRawImport(binding: Binding): boolean {
	if (!binding.path.isImportDefaultSpecifier()) return false;
	const parent = binding.path.parent as t.ImportDeclaration;
	if (parent.importKind === "type") return false;
	return isRawCssSpecifier(String(parent.source.value));
}

function isStaticAuthorArg(node: t.Node, scope: NodePath["scope"]): boolean {
	const expr = unwrap(node);
	if (expr.type === "BinaryExpression" && expr.operator === "+") {
		return (
			isStaticAuthorArg(expr.left, scope) &&
			isStaticAuthorArg(expr.right, scope)
		);
	}
	return isStaticInit(expr, scope, new Set());
}

function isStaticInit(
	node: t.Node | null | undefined,
	scope: NodePath["scope"],
	stack: Set<string>,
): boolean {
	if (!node) return false;
	const expr = unwrap(node);
	if (expr.type === "StringLiteral") return true;
	if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
		return true;
	}
	if (expr.type === "Identifier") return isStaticRef(expr.name, scope, stack);
	return false;
}

function isStaticRef(
	name: string,
	scope: NodePath["scope"],
	stack: Set<string>,
): boolean {
	if (stack.has(name)) return false;
	const binding = scope.getBinding(name);
	if (!binding || binding.kind === "param") return false;
	// Babel reports an unreassigned `let` as constant. Only a const, or a
	// raw import that is never written, is author CSS. A const that aliases
	// a let fails when this walk reaches the let.
	if (binding.constant === false) return false;
	if (binding.constantViolations?.length) return false;
	// esbuild emits a marked const as var. Direct eval in this scope can
	// assign user CSS into that binding, and the renderer would trust it.
	if (directEvalBlocks?.has(evalScope(binding.scope).block)) return false;
	stack.add(name);
	if (isRawImport(binding)) return true;
	if (binding.kind !== "const") return false;
	if (!binding.path.isVariableDeclarator()) return false;
	return isStaticInit(binding.path.node.init, binding.scope, stack);
}

function partFrom(
	node: t.Node,
	scope: NodePath["scope"],
	stack: Set<string>,
): Part | null {
	const expr = unwrap(node);
	if (expr.type === "StringLiteral") return { type: "lit", value: expr.value };
	if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
		return {
			type: "lit",
			value: expr.quasis.map((quasi) => quasi.value.cooked ?? "").join(""),
		};
	}
	if (expr.type === "Identifier" && isStaticRef(expr.name, scope, stack)) {
		return { type: "ref", name: expr.name };
	}
	return null;
}

function readParts(path: NodePath<t.JSXElement>): Part[] | null {
	const parts: Part[] = [];
	for (const child of path.node.children) {
		if (child.type === "JSXText") {
			if (child.value.length > 0)
				parts.push({ type: "lit", value: child.value });
			continue;
		}
		if (child.type === "JSXExpressionContainer") {
			if (child.expression.type === "JSXEmptyExpression") continue;
			const part = partFrom(child.expression, path.scope, new Set());
			if (!part) return null;
			parts.push(part);
			continue;
		}
		return null;
	}
	const meaningful = parts.some(
		(part) => part.type === "ref" || part.value.trim() !== "",
	);
	return meaningful ? parts : null;
}

function buildArg(parts: Part[]): t.Expression {
	const nodes: t.Expression[] = [];
	for (const part of parts) {
		const node =
			part.type === "lit"
				? t.stringLiteral(part.value)
				: t.identifier(part.name);
		const previous = nodes[nodes.length - 1];
		if (previous?.type === "StringLiteral" && node.type === "StringLiteral") {
			previous.value += node.value;
			continue;
		}
		nodes.push(node);
	}
	return nodes
		.slice(1)
		.reduce<t.Expression>(
			(left, right) => t.binaryExpression("+", left, right),
			nodes[0] as t.Expression,
		);
}

let directEvalBlocks: Set<t.Node> | null = null;

type EvalScope = { block: t.Node; parent: EvalScope | null };

function evalScope(scope: NodePath["scope"]): EvalScope {
	return scope as unknown as EvalScope;
}

function scopesWithDirectEval(ast: t.Node): Set<t.Node> {
	const blocks = new Set<t.Node>();
	const visit = traverse as (node: t.Node, visitors: object) => void;
	visit(ast, {
		CallExpression(path: NodePath<t.CallExpression>) {
			if (path.node.optional) return;
			const callee = unwrap(path.node.callee);
			if (callee.type !== "Identifier" || callee.name !== "eval") return;
			let scope: EvalScope | null = evalScope(path.scope);
			while (scope) {
				blocks.add(scope.block);
				scope = scope.parent;
			}
		},
	});
	return blocks;
}

export function markerLocalName(filename: string): string {
	const hash = createHash("sha256").update(filename).digest("hex").slice(0, 8);
	return `_igniteAuthor$${hash}`;
}

export function markerCallee(code: string): string {
	const alias = code.match(/igniteAuthorStyle as ([A-Za-z0-9_$]+)/);
	return alias?.[1] ?? "igniteAuthorStyle";
}

function ensureImport(program: t.Program, local: string): void {
	const decl = t.importDeclaration(
		[t.importSpecifier(t.identifier(local), t.identifier("igniteAuthorStyle"))],
		t.stringLiteral(AUTHOR_VIRTUAL),
	);
	let insertAt = 0;
	for (let index = 0; index < program.body.length; index += 1) {
		const stmt = program.body[index];
		if (
			stmt.type === "ExpressionStatement" &&
			"directive" in stmt &&
			stmt.directive
		) {
			insertAt = index + 1;
			continue;
		}
		if (stmt.type === "ImportDeclaration") insertAt = index + 1;
	}
	program.body.splice(insertAt, 0, decl);
}

export function isBlockedAuthorSpecifier(value: string): boolean {
	if (value === AUTHOR_VIRTUAL || value === AUTHOR_SOURCE) return true;
	if (
		value === "@ignite-element/renderer/jsx/author-style" ||
		value === "@ignite-element/renderer/jsx/author-style-mark"
	) {
		return true;
	}
	const file = value.split("?")[0].split("\\").join("/");
	return MARK_FILE.test(file);
}

function specifierOf(node: t.Node | null | undefined): string | null {
	if (!node) return null;
	const expr = unwrap(node);
	if (expr.type === "StringLiteral") return expr.value;
	if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
		return expr.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
	}
	return null;
}

function resolvedRendererRoot(filename: string): string | null {
	try {
		let dir = path.dirname(
			createRequire(filename).resolve("@ignite-element/renderer"),
		);
		for (let depth = 0; depth < 6; depth += 1) {
			const manifest = path.join(dir, "package.json");
			if (existsSync(manifest)) {
				const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
					name?: string;
				};
				if (parsed.name === "@ignite-element/renderer")
					return realpathSync(dir);
			}
			const parent = path.dirname(dir);
			if (parent === dir) return null;
			dir = parent;
		}
		return null;
	} catch {
		return null;
	}
}

function libraryRelativeAuthorImport(filename: string, value: string): boolean {
	if (!value.startsWith(".")) return false;
	if (!/author-style|authorStyle/.test(value)) return false;
	let file = filename;
	try {
		if (lstatSync(file).isSymbolicLink()) return false;
		file = realpathSync(file);
	} catch {
		return false;
	}
	// Trust the file only when it is inside the package Node resolved.
	// A package.json name in an app folder does not count.
	const root = resolvedRendererRoot(file);
	if (!root) return false;
	return file === root || file.startsWith(`${root}${path.sep}`);
}

function rejectSpecifier(value: string, filename: string): void {
	if (
		!isBlockedAuthorSpecifier(value) &&
		!/author-style|authorStyle/.test(value)
	) {
		return;
	}
	if (libraryRelativeAuthorImport(filename, value)) return;
	throw new Error(
		`An application import from "${value}" cannot mark CSS. The ignite JSX plugin marks static <style> text itself.`,
	);
}

function escapeRegExp(value: string): string {
	return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function templateResolvesToMark(parts: string[], filename: string): boolean {
	const prefix = parts[0] ?? "";
	const slash = prefix.lastIndexOf("/");
	if (slash <= 0) return false;
	const rawDir = prefix.slice(0, slash);
	const namePrefix = prefix.slice(slash + 1);
	const dir = path.isAbsolute(rawDir)
		? rawDir
		: path.resolve(path.dirname(filename), rawDir);
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return false;
	}
	const pattern = new RegExp(
		`^${escapeRegExp(namePrefix)}${parts
			.slice(1)
			.map((part) => `[^/]*${escapeRegExp(part)}`)
			.join("")}$`,
	);
	for (const name of names) {
		if (!pattern.test(name)) continue;
		const full = path.join(dir, name);
		let real = full;
		try {
			real = realpathSync(full);
		} catch {
			real = full;
		}
		if (isBlockedAuthorSpecifier(real.split("\\").join("/"))) return true;
	}
	return false;
}

function rejectTemplate(node: t.TemplateLiteral, filename: string): void {
	const parts = node.quasis.map(
		(quasi) => quasi.value.cooked ?? quasi.value.raw ?? "",
	);
	const spelled = parts.some((part) => /author-style|authorStyle/.test(part));
	if (!spelled && !templateResolvesToMark(parts, filename)) return;
	throw new Error(
		`An application import from "${parts.join("${" + "...}")}" cannot mark CSS. The ignite JSX plugin marks static <style> text itself.`,
	);
}

function rejectImportSource(
	node: t.Node | null | undefined,
	filename: string,
): void {
	const value = specifierOf(node);
	if (value) {
		rejectSpecifier(value, filename);
		return;
	}
	if (!node) return;
	const expr = unwrap(node);
	if (expr.type === "TemplateLiteral") rejectTemplate(expr, filename);
}

function countMarkerUses(ast: t.Node, name: string): number {
	let count = 0;
	const visit = traverse as (node: t.Node, visitors: object) => void;
	visit(ast, {
		Identifier(path: NodePath<t.Identifier>) {
			if (path.node.name !== name) return;
			if (
				path.parent.type === "ImportSpecifier" &&
				path.parent.local === path.node
			) {
				return;
			}
			count += 1;
		},
	});
	return count;
}

function specifierImportedName(spec: t.ImportSpecifier): string {
	if (spec.imported.type === "Identifier") return spec.imported.name;
	return spec.imported.value;
}

function isOfficialMarkImport(
	node: t.ImportDeclaration,
	filename: string,
): boolean {
	if (node.importKind === "type") return false;
	const source = String(node.source.value);
	if (source !== AUTHOR_VIRTUAL && source !== AUTHOR_STANDALONE) return false;
	if (node.specifiers.length !== 1) return false;
	const spec = node.specifiers[0];
	if (!spec || spec.type !== "ImportSpecifier" || spec.importKind === "type") {
		return false;
	}
	if (specifierImportedName(spec) !== "igniteAuthorStyle") return false;
	return spec.local.name === markerLocalName(filename);
}

function refuseMark(): never {
	throw new Error(
		"An application import cannot mark CSS. The ignite JSX plugin marks static <style> text itself.",
	);
}

function jsxImportSource(ast: t.File): string | null {
	for (const comment of ast.comments ?? []) {
		const match = /@jsxImportSource\s+(\S+)/.exec(comment.value);
		if (match?.[1]) return match[1];
	}
	return null;
}

function shouldMarkStyles(ast: t.File): boolean {
	const source = jsxImportSource(ast);
	if (!source) return true;
	return (
		source === "ignite-element/jsx" || source.startsWith("ignite-element/jsx/")
	);
}

function officialMarkImport(
	ast: t.File,
	filename: string,
): t.ImportDeclaration | null {
	for (const statement of ast.program.body) {
		if (statement.type !== "ImportDeclaration") continue;
		if (isOfficialMarkImport(statement, filename)) return statement;
	}
	return null;
}

function meaningfulJsxChildren(
	element: t.JSXElement,
): t.JSXElement["children"] {
	return element.children.filter((child) => {
		if (child.type !== "JSXText") return true;
		return child.value.trim() !== "";
	});
}

function assertOfficialCalls(ast: t.File, local: string): number {
	let count = 0;
	const visit = traverse as (node: t.Node, visitors: object) => void;
	visit(ast, {
		Identifier(path: NodePath<t.Identifier>) {
			if (path.node.name !== local) return;
			if (
				path.parent.type === "ImportSpecifier" &&
				path.parent.local === path.node
			) {
				return;
			}
			const callPath = path.parentPath;
			const call = path.parent;
			if (
				!callPath ||
				call.type !== "CallExpression" ||
				call.callee !== path.node ||
				call.arguments.length !== 1 ||
				!isStaticAuthorArg(call.arguments[0], path.scope)
			) {
				refuseMark();
			}
			const container = callPath.parent;
			const element = callPath.parentPath?.parent;
			if (
				container?.type !== "JSXExpressionContainer" ||
				element?.type !== "JSXElement" ||
				!isStyleTag(element.openingElement.name)
			) {
				refuseMark();
			}
			const elementNode = element as t.JSXElement;
			const meaningful = meaningfulJsxChildren(elementNode);
			if (meaningful.length !== 1 || meaningful[0] !== container) refuseMark();
			count += 1;
		},
	});
	return count;
}

function rejectHandWrittenAuthorImport(ast: t.File, filename: string): void {
	const visit = traverse as (node: t.Node, visitors: object) => void;
	visit(ast, {
		ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
			if (isOfficialMarkImport(path.node, filename)) return;
			rejectSpecifier(String(path.node.source.value), filename);
		},
		ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
			rejectSpecifier(String(path.node.source.value), filename);
		},
		ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
			if (path.node.source)
				rejectSpecifier(String(path.node.source.value), filename);
		},
		CallExpression(path: NodePath<t.CallExpression>) {
			const callee = unwrap(path.node.callee);
			const isImport = callee.type === "Import";
			const isRequire =
				callee.type === "Identifier" && callee.name === "require";
			if (!isImport && !isRequire) return;
			rejectImportSource(path.node.arguments[0], filename);
		},
		// Babel 7.29 parses import() as ImportExpression, not CallExpression.
		ImportExpression(path: NodePath<t.CallExpression> & { node: t.Node }) {
			const source = (path.node as { source?: t.Node }).source;
			rejectImportSource(source, filename);
		},
	});
}

export function markFile(ast: t.File, filename = "component.tsx"): boolean {
	rejectHandWrittenAuthorImport(ast, filename);
	const official = officialMarkImport(ast, filename);
	if (!shouldMarkStyles(ast)) {
		if (official) refuseMark();
		return false;
	}
	directEvalBlocks = scopesWithDirectEval(ast);
	try {
		const local = markerLocalName(filename);
		const officialUses = official ? assertOfficialCalls(ast, local) : 0;
		const hits: Array<{ element: t.JSXElement; parts: Part[] }> = [];
		traverse(ast, {
			JSXElement(path) {
				if (!isStyleTag(path.node.openingElement.name)) return;
				const parts = readParts(path);
				if (!parts) return;
				hits.push({ element: path.node, parts });
			},
		});
		if (!official && hits.length === 0) return false;
		if (official && officialUses === 0 && hits.length === 0) refuseMark();
		if (!official) {
			const already = countMarkerUses(ast, local);
			if (already > 0) {
				throw new Error(
					`Marker references (${already + hits.length}) outnumber marked <style> elements (${hits.length}).`,
				);
			}
		}
		for (const hit of hits) {
			hit.element.children = [
				t.jsxExpressionContainer(
					t.callExpression(t.identifier(local), [buildArg(hit.parts)]),
				),
			];
		}
		if (official) {
			official.source.value = AUTHOR_VIRTUAL;
		} else {
			ensureImport(ast.program, local);
		}
		const uses = countMarkerUses(ast, local);
		const expected = officialUses + hits.length;
		if (uses !== expected) {
			throw new Error(
				`Marker references (${uses}) outnumber marked <style> elements (${expected}).`,
			);
		}
		return true;
	} finally {
		directEvalBlocks = null;
	}
}

export function transformSource(
	code: string,
	filename = "component.tsx",
	options?: { jsxScript?: boolean },
): string {
	const ast = parse(code, {
		sourceFilename: filename,
		sourceType: "module",
		plugins: parserPluginsFor(filename, options?.jsxScript === true),
	});
	if (!markFile(ast, filename)) return code;
	return generate(ast, { comments: true, retainLines: true }, code).code;
}
