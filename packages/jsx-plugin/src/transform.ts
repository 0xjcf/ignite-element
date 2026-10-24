import generateModule from "@babel/generator";
import { parse } from "@babel/parser";
import type { Binding, NodePath } from "@babel/traverse";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

/** Public name. The plugin rejects it. It is not inserted. */
export const AUTHOR_SOURCE = "ignite-element/jsx/author-style";
/** Private id inserted only by this plugin. Bundlers resolve it for that import alone. */
export const AUTHOR_VIRTUAL = "\0ignite-jsx:author-style";
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
	if (name.type === "JSXIdentifier") return name.name.toLowerCase() === "style";
	if (name.type === "JSXNamespacedName") {
		return name.name.name.toLowerCase() === "style";
	}
	return false;
}

function isRawImport(binding: Binding): boolean {
	if (!binding.path.isImportDefaultSpecifier()) return false;
	const parent = binding.path.parent as t.ImportDeclaration;
	if (parent.importKind === "type") return false;
	return isRawCssSpecifier(String(parent.source.value));
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

function resolveCallee(path: NodePath<t.JSXElement>): string {
	const local = "igniteAuthorStyle";
	const binding = path.scope.getBinding(local);
	if (!binding) return local;
	throw new Error(
		`igniteAuthorStyle is already declared in this file. The ignite JSX plugin will not mark <style>. Rename the other binding.`,
	);
}

function ensureImport(program: t.Program, callee: string): void {
	const decl = t.importDeclaration(
		[
			t.importSpecifier(
				t.identifier(callee),
				t.identifier("igniteAuthorStyle"),
			),
		],
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

function rejectSpecifier(value: string): void {
	if (!isBlockedAuthorSpecifier(value)) return;
	throw new Error(
		`An application import from "${value}" cannot mark CSS. The ignite JSX plugin marks static <style> text itself.`,
	);
}

function rejectHandWrittenAuthorImport(ast: t.File): void {
	const visit = traverse as (node: t.Node, visitors: object) => void;
	visit(ast, {
		ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
			rejectSpecifier(String(path.node.source.value));
		},
		ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
			rejectSpecifier(String(path.node.source.value));
		},
		ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
			if (path.node.source) rejectSpecifier(String(path.node.source.value));
		},
		CallExpression(path: NodePath<t.CallExpression>) {
			const callee = unwrap(path.node.callee);
			const isImport = callee.type === "Import";
			const isRequire =
				callee.type === "Identifier" && callee.name === "require";
			if (!isImport && !isRequire) return;
			const value = specifierOf(path.node.arguments[0]);
			if (value) rejectSpecifier(value);
		},
	});
}

export function markFile(ast: t.File): boolean {
	rejectHandWrittenAuthorImport(ast);
	const hits: Array<{ element: t.JSXElement; parts: Part[]; callee: string }> =
		[];
	traverse(ast, {
		JSXElement(path) {
			if (!isStyleTag(path.node.openingElement.name)) return;
			const parts = readParts(path);
			if (!parts) return;
			hits.push({ element: path.node, parts, callee: resolveCallee(path) });
		},
	});
	if (hits.length === 0) return false;
	for (const hit of hits) {
		hit.element.children = [
			t.jsxExpressionContainer(
				t.callExpression(t.identifier(hit.callee), [buildArg(hit.parts)]),
			),
		];
	}
	ensureImport(ast.program, hits[0].callee);
	return true;
}

export function transformSource(
	code: string,
	filename = "component.tsx",
): string {
	const ast = parse(code, {
		sourceFilename: filename,
		sourceType: "module",
		plugins: ["typescript", "jsx"],
	});
	if (!markFile(ast)) return code;
	return generate(ast, { comments: true, retainLines: true }, code).code;
}
