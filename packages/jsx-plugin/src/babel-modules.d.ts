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
		block: t.Node;
		path: NodePath;
		getProgramParent(): Scope;
		generateUidIdentifier(name?: string): t.Identifier;
		getBinding(name: string): Binding | undefined;
	}

	interface NodePath<T = t.Node> {
		node: T;
		parent: t.Node;
		scope: Scope;
		parentPath: NodePath | null;
		unshiftContainer(listKey: string, nodes: t.Node[]): NodePath[];
		isImportSpecifier(): this is NodePath<t.ImportSpecifier>;
		isImportDefaultSpecifier(): this is NodePath<t.ImportDefaultSpecifier>;
		isImportDeclaration(): this is NodePath<t.ImportDeclaration>;
		isVariableDeclarator(): this is NodePath<t.VariableDeclarator>;
		isReferencedIdentifier(): boolean;
		get<K extends keyof T>(key: K): T[K] extends Array<infer Child> ? NodePath<Child>[] : NodePath<T[K]>;
		get(key: string): NodePath<t.Node | null | undefined> | NodePath<t.Node | null | undefined>[];
		isIdentifier(): this is NodePath<t.Identifier>;
		isSequenceExpression(): this is NodePath<t.SequenceExpression>;
		isConditionalExpression(): this is NodePath<t.ConditionalExpression>;
		isArrayExpression(): this is NodePath<t.ArrayExpression>;
		isAssignmentExpression(): this is NodePath<t.AssignmentExpression>;
		isMemberExpression(): this is NodePath<t.MemberExpression>;
		isOptionalMemberExpression(): this is NodePath<t.OptionalMemberExpression>;

	}

	interface Binding {
		path: NodePath;
		identifier: t.Identifier;
		kind: string;
		scope: Scope;
		constant: boolean;
		constantViolations: NodePath[];
	}

	function traverse(
		parent: t.Node,
		opts: {
			JSXElement?: (path: NodePath<t.JSXElement>) => void;
			Identifier?: (path: NodePath<t.Identifier>) => void;
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
