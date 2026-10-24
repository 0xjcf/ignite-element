import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
	fileURLToPath(new URL("../../../package.json", import.meta.url)),
);
const ts = require("typescript");

const IMPORT_LINE =
	'import { igniteAuthorStyle } from "#ignite/author-style";\n';

/**
 * Minimum Solid-style step. Static `<style>` text, including a const in
 * this file whose initializer is a string with no substitution, becomes
 * igniteAuthorStyle("..."). An expression, a template substitution, an
 * import, or a parameter stays as data. Cross-file constants are not traced.
 */
export function transformAuthorStyle(source) {
	const file = ts.createSourceFile(
		"component.tsx",
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const scopes = [new Map()];
	const replacements = [];

	function pushScope() {
		scopes.push(new Map());
	}
	function popScope() {
		scopes.pop();
	}
	function bind(name, value) {
		scopes[scopes.length - 1].set(name, value);
	}
	function lookup(name) {
		for (let index = scopes.length - 1; index >= 0; index -= 1) {
			if (scopes[index].has(name)) return scopes[index].get(name);
		}
		return undefined;
	}

	function staticText(node) {
		if (!node) return undefined;
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			return node.text;
		}
		if (ts.isTemplateExpression(node)) return undefined;
		if (ts.isParenthesizedExpression(node)) return staticText(node.expression);
		if (ts.isIdentifier(node)) return lookup(node.text);
		return undefined;
	}

	function bindName(name, initializer) {
		if (!ts.isIdentifier(name)) return;
		const text = staticText(initializer);
		bind(name.text, text);
	}

	function isStyleTag(name) {
		return ts.isIdentifier(name) && name.text === "style";
	}

	function considerStyle(node) {
		const meaningful = node.children.filter((child) => {
			if (ts.isJsxText(child)) return child.text.trim().length > 0;
			return true;
		});
		if (meaningful.length === 0) return;
		let joined = "";
		for (const child of meaningful) {
			if (ts.isJsxText(child)) {
				joined += child.text;
				continue;
			}
			if (
				ts.isJsxExpression(child) &&
				child.expression &&
				staticText(child.expression) !== undefined
			) {
				joined += staticText(child.expression);
				continue;
			}
			return;
		}
		const start = meaningful[0].getStart(file);
		const end = meaningful[meaningful.length - 1].getEnd();
		replacements.push({
			start,
			end,
			text: `{igniteAuthorStyle(${JSON.stringify(joined)})}`,
		});
	}

	function visit(node) {
		if (
			ts.isFunctionDeclaration(node) ||
			ts.isFunctionExpression(node) ||
			ts.isArrowFunction(node) ||
			ts.isMethodDeclaration(node) ||
			ts.isConstructorDeclaration(node) ||
			ts.isModuleDeclaration(node)
		) {
			pushScope();
			for (const param of node.parameters ?? []) {
				if (ts.isIdentifier(param.name)) bind(param.name.text, undefined);
			}
			ts.forEachChild(node, visit);
			popScope();
			return;
		}
		if (ts.isVariableDeclaration(node)) {
			bindName(node.name, node.initializer);
		}
		if (
			(ts.isJsxElement(node) && isStyleTag(node.openingElement.tagName)) ||
			(ts.isJsxSelfClosingElement(node) && isStyleTag(node.tagName))
		) {
			if (ts.isJsxElement(node)) considerStyle(node);
		}
		ts.forEachChild(node, visit);
	}

	visit(file);
	if (replacements.length === 0) return { code: source, marked: false };
	replacements.sort((left, right) => right.start - left.start);
	let code = source;
	for (const replacement of replacements) {
		code =
			code.slice(0, replacement.start) +
			replacement.text +
			code.slice(replacement.end);
	}
	if (!code.includes("#ignite/author-style")) code = IMPORT_LINE + code;
	return { code, marked: true };
}
