declare module "@babel/generator" {
	import type * as t from "@babel/types";
	function generate(
		ast: t.Node,
		opts?: { comments?: boolean; retainLines?: boolean },
		code?: string,
	): { code: string };
	export default generate;
}

declare module "@babel/traverse" {
	import type * as t from "@babel/types";

	interface Scope {
		getProgramParent(): { block: t.Node };
		getBinding(name: string): Binding | undefined;
	}

	interface NodePath<T = t.Node> {
		node: T;
		parent: t.Node;
		scope: Scope;
		parentPath: NodePath | null;
		isImportSpecifier(): this is NodePath<t.ImportSpecifier>;
		isImportDefaultSpecifier(): this is NodePath<t.ImportDefaultSpecifier>;
		isImportDeclaration(): this is NodePath<t.ImportDeclaration>;
		isVariableDeclarator(): this is NodePath<t.VariableDeclarator>;
	}

	interface Binding {
		path: NodePath;
		identifier: t.Identifier;
		kind: string;
		scope: Scope;
	}

	function traverse(
		parent: t.Node,
		opts: {
			JSXElement?: (path: NodePath<t.JSXElement>) => void;
		},
	): void;

	export type { Binding, NodePath };
	export default traverse;
}

declare module "@babel/core" {
	function transformSync(
		code: string,
		opts: object,
	): { code: string | null } | null;
	export { transformSync };
}
