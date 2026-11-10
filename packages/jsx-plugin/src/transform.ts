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
import { getTsconfig } from "get-tsconfig";

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

export function unwrap(node: t.Node): t.Node {
	let current = node;
	while (
		current.type === "ParenthesizedExpression" ||
		current.type === "TSAsExpression" ||
		current.type === "TSTypeAssertion" ||
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

/** Resolve only references already proved static, before a compiler lowers const.
 * Raw CSS stays an import; a fresh alias avoids capturing a shadowing local.
 */
function compilerRef(
	name: string,
	scope: NodePath["scope"],
	useScope: NodePath["scope"],
): Part {
	const binding = scope.getBinding(name);
	if (binding && isRawImport(binding)) {
		if (useScope.getBinding(name) === binding) return { type: "ref", name };
		const declaration = binding.path.parent;
		if (declaration.type === "ImportDeclaration") {
			const program = useScope.getProgramParent();
			const alias = program.generateUidIdentifier("igniteCss");
			program.path.unshiftContainer("body", [
				t.importDeclaration(
					[t.importDefaultSpecifier(alias)],
					t.cloneNode(declaration.source),
				),
			]);
			return { type: "ref", name: alias.name };
		}
	}
	if (binding?.path.isVariableDeclarator() && binding.path.node.init) {
		const init = unwrap(binding.path.node.init);
		if (init.type === "StringLiteral")
			return { type: "lit", value: init.value };
		if (init.type === "TemplateLiteral")
			return {
				type: "lit",
				value: init.quasis.map((quasi) => quasi.value.cooked ?? "").join(""),
			};
		if (init.type === "Identifier")
			return compilerRef(init.name, binding.scope, useScope);
	}
	return { type: "ref", name };
}

function readParts(
	path: NodePath<t.JSXElement>,
	resolveConstants: boolean,
): Part[] | null {
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
	if (!meaningful) return null;
	return resolveConstants
		? parts.map((part) =>
				part.type === "ref"
					? compilerRef(part.name, path.scope, path.scope)
					: part,
			)
		: parts;
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

export function rejectImportSource(
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

function isOfficialMarkImport(node: t.ImportDeclaration): boolean {
	if (node.importKind === "type") return false;
	const source = String(node.source.value);
	if (source !== AUTHOR_VIRTUAL && source !== AUTHOR_STANDALONE) return false;
	if (node.specifiers.length !== 1) return false;
	const spec = node.specifiers[0];
	if (!spec || spec.type !== "ImportSpecifier" || spec.importKind === "type") {
		return false;
	}
	if (specifierImportedName(spec) !== "igniteAuthorStyle") return false;
	// The compiler may move the output. This name avoids collisions; it is
	// not authority. assertOfficialCalls revalidates every static style use.
	return /^_igniteAuthor\$[0-9a-f]{8}$/.test(spec.local.name);
}

function refuseMark(): never {
	throw new Error(
		"An application import cannot mark CSS. The ignite JSX plugin marks static <style> text itself.",
	);
}

function jsxImportSource(ast: t.File): string | null {
	const sources: string[] = [];
	for (const comment of ast.comments ?? []) {
		for (const match of comment.value.matchAll(/@jsxImportSource\s+(\S+)/g)) {
			if (match[1]) sources.push(match[1]);
		}
	}
	if (sources.length > 1) {
		throw new Error(
			"A file can have only one @jsxImportSource comment. The ignite JSX plugin and the bundler would otherwise disagree.",
		);
	}
	return sources[0] ?? null;
}

export function projectJsxImportSource(filename: string): string | undefined {
	const project =
		getTsconfig(filename) ??
		getTsconfig(filename, { configName: "jsconfig.json" });
	return project
		? (project.config.compilerOptions?.jsxImportSource ?? "react")
		: undefined;
}

function shouldMarkStyles(ast: t.File, fallback?: string): boolean {
	const runtime = ast.program.body.find(
		(node) =>
			node.type === "ImportDeclaration" &&
			/\/jsx-(?:dev-)?runtime$/.test(node.source.value),
	);
	const source =
		jsxImportSource(ast) ??
		(runtime?.type === "ImportDeclaration"
			? runtime.source.value.replace(/\/jsx-(?:dev-)?runtime$/, "")
			: fallback);
	if (!source) return true;
	return (
		source === "ignite-element/jsx" || source.startsWith("ignite-element/jsx/")
	);
}

function officialMarkImport(ast: t.File): t.ImportDeclaration | null {
	for (const statement of ast.program.body) {
		if (statement.type !== "ImportDeclaration") continue;
		if (isOfficialMarkImport(statement)) return statement;
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

function isLoweredStyleChild(path: NodePath): boolean {
	const property = path.parent;
	const props = path.parentPath?.parentPath;
	if (
		property.type !== "ObjectProperty" ||
		property.computed ||
		property.value !== path.node ||
		!(
			(property.key.type === "Identifier" &&
				property.key.name === "children") ||
			(property.key.type === "StringLiteral" &&
				property.key.value === "children")
		) ||
		props?.node.type !== "ObjectExpression"
	)
		return false;
	const index = props.node.properties.indexOf(property);
	if (
		index < 0 ||
		props.node.properties.slice(index + 1).some(mayWriteChildren)
	)
		return false;
	let value: t.Expression = props.node;
	let invocation = props.parentPath;
	while (
		invocation?.node.type === "CallExpression" &&
		isPropsMerge(invocation.node, invocation.scope)
	) {
		const argument = invocation.node.arguments.indexOf(value);
		if (
			argument < 0 ||
			invocation.node.arguments
				.slice(argument + 1)
				.some(
					(node) =>
						node.type !== "ObjectExpression" ||
						node.properties.some(mayWriteChildren),
				)
		)
			return false;
		value = invocation.node;
		invocation = invocation.parentPath;
	}
	if (invocation?.node.type !== "CallExpression") return false;
	const call = invocation.node;
	if (
		call.arguments[0]?.type !== "StringLiteral" ||
		!/^(?:[^:]+:)?style$/.test(call.arguments[0].value) ||
		call.arguments[1] !== value ||
		call.callee.type !== "Identifier"
	)
		return false;
	const binding = invocation.scope.getBinding(call.callee.name);
	if (!binding?.path.isImportSpecifier() || binding.constant === false)
		return false;
	const imported = binding.path.node;
	const declaration = binding.path.parent;
	return (
		declaration.type === "ImportDeclaration" &&
		/^ignite-element\/jsx\/jsx-(?:dev-)?runtime$/.test(
			declaration.source.value,
		) &&
		["jsx", "jsxs", "jsxDEV"].includes(specifierImportedName(imported))
	);
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
			if (isLoweredStyleChild(callPath)) {
				count += 1;
				return;
			}
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

/** A locally shadowed module object is data, not Node's CommonJS module port. */
function isNodeModuleRequire(
	callee: t.Node,
	scope: NodePath["scope"],
): boolean {
	if (
		callee.type !== "MemberExpression" &&
		callee.type !== "OptionalMemberExpression"
	)
		return false;
	const object = unwrap(callee.object);
	return (
		object.type === "Identifier" &&
		object.name === "module" &&
		!scope.getBinding("module") &&
		memberName(callee) === "require"
	);
}

/** A later reassignment cannot erase a load through the initial function. */
function forwardsFirstParameter(
	fn: NonNullable<ReturnType<typeof boundFunction>>,
	forwarded: ReadonlySet<t.Identifier>,
): boolean {
	const parameter = fn.params[0];
	const first =
		parameter?.type === "AssignmentPattern"
			? parameter.left
			: parameter?.type === "RestElement"
				? parameter.argument
				: parameter;
	return first?.type === "Identifier" && forwarded.has(first);
}

function evaluatedPath(
	source: NodePath<t.Node | null | undefined> | undefined,
): NodePath<t.Node> | undefined {
	if (!source?.node) return undefined;
	if (unwrap(source.node) !== source.node)
		return evaluatedPath(
			source.get("expression") as NodePath<t.Node | null | undefined>,
		);
	if (source.isSequenceExpression())
		return evaluatedPath(source.get("expressions").at(-1));
	return source as NodePath<t.Node>;
}

function boundFunction(binding: Binding | undefined) {
	const node = binding?.path.node;
	return node?.type === "FunctionDeclaration"
		? node
		: node?.type === "VariableDeclarator" &&
				(node.init?.type === "FunctionExpression" ||
					node.init?.type === "ArrowFunctionExpression")
			? node.init
			: null;
}

function memberName(
	node: t.MemberExpression | t.OptionalMemberExpression,
): string | undefined {
	return node.computed
		? node.property.type === "StringLiteral"
			? node.property.value
			: undefined
		: node.property.type === "Identifier"
			? node.property.name
			: undefined;
}

/** Resolve lexical loader aliases; unrelated local functions remain ordinary data. */
function isNodeLoader(
	input: NodePath<t.Node | null | undefined> | undefined,
	forwarded: ReadonlySet<t.Identifier>,
	seen = new Set<Binding>(),
): boolean {
	const source = evaluatedPath(input);
	if (!source) return false;
	if (isNodeModuleRequire(source.node, source.scope)) return true;
	if (!source.isIdentifier()) return false;
	const binding = source.scope.getBinding(source.node.name);
	if (!binding) return source.node.name === "require";
	if (seen.has(binding)) return false;
	seen.add(binding);
	const fn = boundFunction(binding);
	if (fn && forwardsFirstParameter(fn, forwarded)) return true;
	if (fn && binding.constantViolations.length === 0) return false;
	if (
		binding.path.isVariableDeclarator() &&
		isNodeLoader(binding.path.get("init"), forwarded, seen)
	)
		return true;
	for (const violation of binding.constantViolations) {
		if (
			violation.isAssignmentExpression() &&
			isNodeLoader(violation.get("right"), forwarded, seen)
		)
			return true;
	}
	// A require binding not proven to be an ordinary stable function stays guarded.
	return source.node.name === "require";
}

type ModuleCallTarget = {
	path: NodePath<t.Node | null | undefined>;
	opaqueList?: boolean;
};

/** Array bindings can keep their identity while their first element changes. */
function applyTargets(
	input: NodePath<t.Node | null | undefined> | undefined,
	seen = new Set<Binding>(),
): ModuleCallTarget[] {
	const source = evaluatedPath(input);
	if (!source) return [];
	if (source.isArrayExpression()) {
		const first = source.get("elements")[0];
		return first?.node ? [{ path: first }] : [];
	}
	if (!source.isIdentifier()) return [{ path: source, opaqueList: true }];
	const binding = source.scope.getBinding(source.node.name);
	if (!binding || seen.has(binding) || !binding.path.isVariableDeclarator())
		return [{ path: source, opaqueList: true }];
	seen.add(binding);
	const targets = applyTargets(binding.path.get("init"), seen);
	let opaque = binding.kind !== "const" || !binding.path.node.init;
	for (const violation of binding.constantViolations) {
		opaque = true;
		if (violation.isAssignmentExpression())
			targets.push(...applyTargets(violation.get("right"), seen));
	}
	for (const reference of binding.referencePaths) {
		if (reference.node === source.node) continue;
		const member = reference.parentPath;
		const assignment = member?.parentPath;
		if (
			member?.isMemberExpression() &&
			member.node.object === reference.node &&
			assignment?.isAssignmentExpression() &&
			assignment.node.left === member.node
		) {
			const property = member.node.property;
			const key =
				member.node.computed &&
				(property.type === "NumericLiteral" ||
					property.type === "StringLiteral")
					? String(property.value)
					: undefined;
			if (key === "0") {
				targets.push({ path: assignment.get("right") });
				if (assignment.node.operator !== "=") opaque = true;
			} else if (key === undefined || !/^\d+$/.test(key)) {
				targets.push({ path: assignment.get("right") });
				opaque = true;
			}
		} else opaque = true;
	}
	if (opaque) targets.push({ path: source, opaqueList: true });
	return targets;
}

/** Normalize possible targets once; opaque argument lists are not specifier values. */
function moduleCallSources(
	path: NodePath<t.CallExpression | t.OptionalCallExpression>,
	forwarded: ReadonlySet<t.Identifier>,
): ModuleCallTarget[] {
	const callee = evaluatedPath(path.get("callee"));
	if (!callee) return [];
	const args = path.get("arguments");
	const target = (index: number): ModuleCallTarget[] =>
		args[index] ? [{ path: args[index] }] : [];
	if (callee.node.type === "Import" || isNodeLoader(callee, forwarded))
		return target(0);
	if (!callee.isMemberExpression() && !callee.isOptionalMemberExpression())
		return [];
	const member = callee as NodePath<
		t.MemberExpression | t.OptionalMemberExpression
	>;
	if (!isNodeLoader(member.get("object"), forwarded)) return [];
	const name = memberName(callee.node);
	if (name === "call") return target(1);
	if (name === "apply") return applyTargets(args[1]);
	return [];
}

function noteForwardedParameter(
	source: NodePath<t.Node | null | undefined> | undefined,
	forwarded: Set<t.Identifier>,
	seen = new Set<Binding>(),
): void {
	if (!source?.node) return;
	if (unwrap(source.node) !== source.node) {
		noteForwardedParameter(
			source.get("expression") as NodePath<t.Node | null | undefined>,
			forwarded,
			seen,
		);
		return;
	}
	if (source.isIdentifier()) {
		if (!source.isReferencedIdentifier()) return;
		const binding = source.scope.getBinding(source.node.name);
		if (!binding || seen.has(binding)) return;
		seen.add(binding);
		if (binding.kind === "param") {
			forwarded.add(binding.identifier);
			return;
		}
		// Discover possible input flow; proving a safe target separately requires const.
		if (binding.path.isVariableDeclarator())
			noteForwardedParameter(binding.path.get("init"), forwarded, seen);
		for (const violation of binding.constantViolations) {
			if (violation.isAssignmentExpression())
				noteForwardedParameter(violation.get("right"), forwarded, seen);
		}
		return;
	}
	// Only the final sequence value and conditional result branches form the target.
	if (source.isSequenceExpression()) {
		noteForwardedParameter(source.get("expressions").at(-1), forwarded, seen);
		return;
	}
	if (source.isConditionalExpression()) {
		noteForwardedParameter(source.get("consequent"), forwarded, seen);
		noteForwardedParameter(source.get("alternate"), forwarded, seen);
		return;
	}
	for (const key of t.VISITOR_KEYS[source.node.type] ?? []) {
		const children = source.get(key);
		for (const child of Array.isArray(children) ? children : [children])
			noteForwardedParameter(child, forwarded, seen);
	}
}

/** Shared lexical classification for source, compiler and resolved-package guards. */
export function moduleLoadSources(ast: t.File): Array<{
	source: t.Node;
	official: boolean;
	kind: "declaration" | "call";
}> {
	const sources: Array<{
		source: t.Node;
		official: boolean;
		kind: "declaration" | "call";
	}> = [];
	const visit = traverse as (node: t.Node, visitors: object) => void;
	const forwarded = new Set<t.Identifier>();
	// A finite binding set reaches a fixed point even through chained wrappers.
	let changed = true;
	while (changed) {
		const before = forwarded.size;
		visit(ast, {
			"CallExpression|OptionalCallExpression"(
				path: NodePath<t.CallExpression | t.OptionalCallExpression>,
			) {
				for (const target of moduleCallSources(path, forwarded))
					if (!target.opaqueList)
						noteForwardedParameter(target.path, forwarded);
			},
			ImportExpression(path: NodePath<t.ImportExpression>) {
				noteForwardedParameter(path.get("source"), forwarded);
			},
		});
		changed = forwarded.size !== before;
	}
	visit(ast, {
		ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
			sources.push({
				source: path.node.source,
				official: isOfficialMarkImport(path.node),
				kind: "declaration",
			});
		},
		ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
			sources.push({
				source: path.node.source,
				official: false,
				kind: "declaration",
			});
		},
		ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
			if (path.node.source)
				sources.push({
					source: path.node.source,
					official: false,
					kind: "declaration",
				});
		},
		"CallExpression|OptionalCallExpression"(
			path: NodePath<t.CallExpression | t.OptionalCallExpression>,
		) {
			for (const { path: source } of moduleCallSources(path, forwarded))
				if (source.node)
					sources.push({ source: source.node, official: false, kind: "call" });
		},
		// Also support parsers configured to emit ImportExpression directly.
		ImportExpression(path: NodePath<t.ImportExpression>) {
			sources.push({ source: path.node.source, official: false, kind: "call" });
		},
	});
	return sources;
}

function rejectHandWrittenAuthorImport(ast: t.File, filename: string): void {
	for (const { source, official } of moduleLoadSources(ast)) {
		if (!official) rejectImportSource(source, filename);
	}
}

export function markFile(
	ast: t.File,
	filename = "component.tsx",
	jsxSource?: string,
	resolveConstants = false,
): boolean {
	rejectHandWrittenAuthorImport(ast, filename);
	const official = officialMarkImport(ast);
	if (!shouldMarkStyles(ast, jsxSource)) {
		if (official) refuseMark();
		return false;
	}
	directEvalBlocks = scopesWithDirectEval(ast);
	try {
		const local =
			official?.specifiers[0]?.local.name ?? markerLocalName(filename);
		const officialUses = official ? assertOfficialCalls(ast, local) : 0;
		const hits: Array<{ element: t.JSXElement; parts: Part[] }> = [];
		traverse(ast, {
			JSXElement(path) {
				if (!isStyleTag(path.node.openingElement.name)) return;
				const parts = readParts(path, resolveConstants);
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
	options?: {
		jsxScript?: boolean;
		jsxImportSource?: string;
		resolveConstants?: boolean;
	},
): string {
	const ast = parse(code, {
		sourceFilename: filename,
		sourceType: "module",
		plugins: parserPluginsFor(filename, options?.jsxScript === true),
	});
	if (
		!markFile(
			ast,
			filename,
			options?.jsxImportSource,
			options?.resolveConstants,
		)
	)
		return code;
	return generate(ast, { comments: true, retainLines: true }, code).code;
}

/** A later unknown key or spread can replace the checked children slot. */
function mayWriteChildren(
	entry: t.ObjectExpression["properties"][number],
): boolean {
	if (entry.type === "SpreadElement") return true;
	const key = entry.key;
	if (key.type === "StringLiteral") return key.value === "children";
	if (key.type === "NumericLiteral") return false;
	if (!entry.computed && key.type === "Identifier")
		return key.name === "children";
	return true;
}

/** Recognize the merge forms emitted by the supported ESM compiler entries. */
function isPropsMerge(
	call: t.CallExpression,
	scope: NodePath["scope"],
): boolean {
	if (
		!call.arguments[0] ||
		!(
			call.arguments[0].type === "ObjectExpression" ||
			(call.arguments[0].type === "CallExpression" &&
				isPropsMerge(call.arguments[0], scope))
		)
	)
		return false;
	const callee = call.callee;
	if (
		callee.type === "MemberExpression" &&
		!callee.computed &&
		callee.object.type === "Identifier" &&
		callee.object.name === "Object" &&
		callee.property.type === "Identifier" &&
		callee.property.name === "assign"
	) {
		return !scope.getBinding("Object");
	}
	if (callee.type !== "Identifier") return false;
	const binding = scope.getBinding(callee.name);
	if (!binding) return false;
	if (binding.path.isImportSpecifier() && binding.constant) {
		const declaration = binding.path.parent;
		return (
			declaration.type === "ImportDeclaration" &&
			declaration.source.value === "tslib" &&
			declaration.importKind !== "type" &&
			binding.path.node.importKind !== "type" &&
			specifierImportedName(binding.path.node) === "__assign"
		);
	}
	if (
		!binding.path.isVariableDeclarator() ||
		!binding.path.node.init ||
		binding.scope.getBinding("Object")
	)
		return false;
	const expected = parse(
		`var ${callee.name} = (this && this.${callee.name}) || function () {
		${callee.name} = Object.assign || function(t) {
			for (var s, i = 1, n = arguments.length; i < n; i++) {
				s = arguments[i];
				for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
			}
			return t;
		};
		return ${callee.name}.apply(this, arguments);
	};`,
		{ sourceType: "module" },
	).program.body[0];
	if (
		expected.type !== "VariableDeclaration" ||
		!t.isNodesEquivalent(binding.path.node.init, expected.declarations[0].init)
	)
		return false;
	const inner = new Set<t.Node>();
	t.traverseFast(binding.path.node.init, (node) => {
		inner.add(node);
	});
	return binding.constantViolations.every((violation) =>
		inner.has(violation.node),
	);
}
