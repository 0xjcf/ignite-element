import ts from "typescript";
import { AUTHOR_SOURCE, transformSource } from "./transform.js";

export default function igniteJsxTypeScript(): ts.TransformerFactory<ts.SourceFile> {
	return (context) => (sourceFile) => {
		const next = transformSource(sourceFile.text, sourceFile.fileName);
		if (next === sourceFile.text) return sourceFile;
		const parsed = ts.createSourceFile(
			sourceFile.fileName,
			next,
			sourceFile.languageVersion,
			true,
			scriptKind(sourceFile.fileName),
		);
		const marked = markedStyles(parsed);
		let index = 0;
		const visitor = (node: ts.Node): ts.Node => {
			if (!ts.isJsxElement(node) || !isStyleTag(node.openingElement.tagName)) {
				return ts.visitEachChild(node, visitor, context);
			}
			const call = marked[index];
			index += 1;
			if (!call) return ts.visitEachChild(node, visitor, context);
			return context.factory.updateJsxElement(
				node,
				node.openingElement,
				[adoptCall(context, call)],
				node.closingElement,
			);
		};
		const visited =
			ts.visitNode(sourceFile, visitor, ts.isSourceFile) ?? sourceFile;
		return insertImport(context, visited, parsed);
	};
}

function scriptKind(fileName: string): ts.ScriptKind {
	if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (fileName.endsWith(".js") || fileName.endsWith(".mjs"))
		return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

function markedStyles(
	sourceFile: ts.SourceFile,
): Array<ts.CallExpression | undefined> {
	const calls: Array<ts.CallExpression | undefined> = [];
	const visit = (node: ts.Node): void => {
		if (ts.isJsxElement(node) && isStyleTag(node.openingElement.tagName)) {
			calls.push(authorCall(node));
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return calls;
}

function authorCall(element: ts.JsxElement): ts.CallExpression | undefined {
	for (const child of element.children) {
		if (!ts.isJsxExpression(child) || !child.expression) continue;
		if (!ts.isCallExpression(child.expression)) continue;
		const callee = child.expression.expression;
		if (ts.isIdentifier(callee) && callee.text === "igniteAuthorStyle")
			return child.expression;
	}
	return undefined;
}

function isStyleTag(name: ts.JsxTagNameExpression): boolean {
	return ts.isIdentifier(name) && name.text.toLowerCase() === "style";
}

function adoptCall(
	context: ts.TransformationContext,
	call: ts.CallExpression,
): ts.JsxExpression {
	return context.factory.createJsxExpression(
		undefined,
		adoptExpression(context, call),
	);
}

function adoptExpression(
	context: ts.TransformationContext,
	node: ts.Expression,
): ts.Expression {
	if (ts.isCallExpression(node)) {
		const callee = node.expression;
		if (!ts.isIdentifier(callee))
			return context.factory.createIdentifier("igniteAuthorStyle");
		return context.factory.createCallExpression(
			context.factory.createIdentifier(callee.text),
			undefined,
			node.arguments.map((arg) => adoptExpression(context, arg)),
		);
	}
	if (ts.isIdentifier(node)) return context.factory.createIdentifier(node.text);
	if (ts.isStringLiteral(node))
		return context.factory.createStringLiteral(node.text);
	if (ts.isNoSubstitutionTemplateLiteral(node)) {
		return context.factory.createNoSubstitutionTemplateLiteral(node.text);
	}
	if (ts.isBinaryExpression(node)) {
		return context.factory.createBinaryExpression(
			adoptExpression(context, node.left),
			node.operatorToken.kind,
			adoptExpression(context, node.right),
		);
	}
	if (ts.isParenthesizedExpression(node)) {
		return context.factory.createParenthesizedExpression(
			adoptExpression(context, node.expression),
		);
	}
	return context.factory.createIdentifier("igniteAuthorStyle");
}

function insertImport(
	context: ts.TransformationContext,
	sourceFile: ts.SourceFile,
	parsed: ts.SourceFile,
): ts.SourceFile {
	if (hasAuthorImport(sourceFile)) return sourceFile;
	if (!parsed.statements.some((statement) => isAuthorImport(statement)))
		return sourceFile;
	const created = context.factory.createImportDeclaration(
		undefined,
		context.factory.createImportClause(
			false,
			undefined,
			context.factory.createNamedImports([
				context.factory.createImportSpecifier(
					false,
					undefined,
					context.factory.createIdentifier("igniteAuthorStyle"),
				),
			]),
		),
		context.factory.createStringLiteral(AUTHOR_SOURCE),
	);
	let insertAt = 0;
	sourceFile.statements.forEach((statement, index) => {
		if (ts.isImportDeclaration(statement)) insertAt = index + 1;
	});
	const statements = [...sourceFile.statements];
	statements.splice(insertAt, 0, created);
	return context.factory.updateSourceFile(sourceFile, statements);
}

function hasAuthorImport(sourceFile: ts.SourceFile): boolean {
	return sourceFile.statements.some((statement) => isAuthorImport(statement));
}

function isAuthorImport(statement: ts.Statement): boolean {
	if (!ts.isImportDeclaration(statement)) return false;
	if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
	if (statement.moduleSpecifier.text !== AUTHOR_SOURCE) return false;
	const clause = statement.importClause;
	if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings))
		return false;
	return clause.namedBindings.elements.some((element) => {
		const imported = element.propertyName ?? element.name;
		return imported.text === "igniteAuthorStyle";
	});
}
