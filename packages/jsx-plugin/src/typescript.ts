import ts from "typescript";
import {
	AUTHOR_STANDALONE,
	AUTHOR_VIRTUAL,
	transformSource,
} from "./transform.js";

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
		const localName = authorLocalName(parsed);
		const marked = markedStyles(parsed, localName);
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
				[adoptCall(context, call, localName)],
				node.closingElement,
			);
		};
		const visited =
			ts.visitNode(sourceFile, visitor, ts.isSourceFile) ?? sourceFile;
		return insertImport(context, visited, parsed, localName);
	};
}

function scriptKind(fileName: string): ts.ScriptKind {
	if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
	if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
	if (fileName.endsWith(".js") || fileName.endsWith(".mjs"))
		return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

function authorLocalName(sourceFile: ts.SourceFile): string {
	for (const statement of sourceFile.statements) {
		if (!isAuthorImport(statement)) continue;
		const clause = statement.importClause;
		if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings))
			continue;
		for (const element of clause.namedBindings.elements) {
			const imported = element.propertyName ?? element.name;
			if (imported.text === "igniteAuthorStyle") return element.name.text;
		}
	}
	return "igniteAuthorStyle";
}

function markedStyles(
	sourceFile: ts.SourceFile,
	localName: string,
): Array<ts.CallExpression | undefined> {
	const calls: Array<ts.CallExpression | undefined> = [];
	const visit = (node: ts.Node): void => {
		if (ts.isJsxElement(node) && isStyleTag(node.openingElement.tagName)) {
			calls.push(authorCall(node, localName));
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return calls;
}

function authorCall(
	element: ts.JsxElement,
	localName: string,
): ts.CallExpression | undefined {
	for (const child of element.children) {
		if (!ts.isJsxExpression(child) || !child.expression) continue;
		if (!ts.isCallExpression(child.expression)) continue;
		const callee = child.expression.expression;
		if (ts.isIdentifier(callee) && callee.text === localName)
			return child.expression;
	}
	return undefined;
}

function isStyleTag(name: ts.JsxTagNameExpression): boolean {
	return ts.isIdentifier(name) && name.text === "style";
}

function adoptCall(
	context: ts.TransformationContext,
	call: ts.CallExpression,
	localName: string,
): ts.JsxExpression {
	return context.factory.createJsxExpression(
		undefined,
		adoptExpression(context, call, localName),
	);
}

function adoptExpression(
	context: ts.TransformationContext,
	node: ts.Expression,
	localName: string,
): ts.Expression {
	if (ts.isCallExpression(node)) {
		const callee = node.expression;
		if (!ts.isIdentifier(callee))
			return context.factory.createIdentifier(localName);
		return context.factory.createCallExpression(
			context.factory.createIdentifier(callee.text),
			undefined,
			node.arguments.map((arg) => adoptExpression(context, arg, localName)),
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
			adoptExpression(context, node.left, localName),
			node.operatorToken.kind,
			adoptExpression(context, node.right, localName),
		);
	}
	if (ts.isParenthesizedExpression(node)) {
		return context.factory.createParenthesizedExpression(
			adoptExpression(context, node.expression, localName),
		);
	}
	return context.factory.createIdentifier(localName);
}

function insertImport(
	context: ts.TransformationContext,
	sourceFile: ts.SourceFile,
	parsed: ts.SourceFile,
	localName: string,
): ts.SourceFile {
	if (hasAuthorImport(sourceFile)) return sourceFile;
	if (!parsed.statements.some((statement) => isAuthorImport(statement)))
		return sourceFile;
	const imported =
		localName === "igniteAuthorStyle"
			? undefined
			: context.factory.createIdentifier("igniteAuthorStyle");
	const created = context.factory.createImportDeclaration(
		undefined,
		context.factory.createImportClause(
			false,
			undefined,
			context.factory.createNamedImports([
				context.factory.createImportSpecifier(
					false,
					imported,
					context.factory.createIdentifier(localName),
				),
			]),
		),
		context.factory.createStringLiteral(AUTHOR_STANDALONE),
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

function isAuthorImport(
	statement: ts.Statement,
): statement is ts.ImportDeclaration {
	if (!ts.isImportDeclaration(statement)) return false;
	if (!ts.isStringLiteral(statement.moduleSpecifier)) return false;
	if (statement.moduleSpecifier.text !== AUTHOR_VIRTUAL) return false;
	const clause = statement.importClause;
	if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings))
		return false;
	return clause.namedBindings.elements.some((element) => {
		const imported = element.propertyName ?? element.name;
		return imported.text === "igniteAuthorStyle";
	});
}
