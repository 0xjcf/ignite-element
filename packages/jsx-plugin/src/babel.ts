import {
	AUTHOR_STANDALONE,
	AUTHOR_VIRTUAL,
	markFile,
	projectJsxImportSource,
} from "./transform.js";

export default function igniteJsxBabel() {
	return {
		name: "ignite-jsx",
		pre(file: {
			ast: Parameters<typeof markFile>[0];
			opts: {
				cwd: string;
				filename?: string;
				plugins: ReadonlyArray<{
					key: string;
					options: { runtime?: string; importSource?: string };
				}>;
			};
		}) {
			// Mutate the current program before presets run. Replacing the
			// program from a reparse of the original source drops the import
			// `@babel/preset-react` automatic runtime has not added yet, and
			// a later replace would wipe it.
			// Babel has resolved preset plugins by pre(), before their visitors
			// insert JSX runtime imports. Respect that compiler selection now.
			const compiler = file.opts.plugins.find((plugin) =>
				/^transform-react-jsx(?:\/development)?$/.test(plugin.key),
			);
			const source = compiler
				? compiler.options.runtime === "classic"
					? "react"
					: (compiler.options.importSource ?? "react")
				: (projectJsxImportSource(file.opts.filename ?? file.opts.cwd) ??
					"react");
			markFile(file.ast, file.opts.filename, source);
			for (const statement of file.ast.program.body) {
				if (
					statement.type !== "ImportDeclaration" ||
					statement.source.value !== AUTHOR_VIRTUAL
				) {
					continue;
				}
				statement.source.value = AUTHOR_STANDALONE;
			}
		},
	};
}
