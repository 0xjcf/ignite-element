import { markFile } from "./transform.js";

export default function igniteJsxBabel() {
	return {
		name: "ignite-jsx",
		pre(file: {
			ast: Parameters<typeof markFile>[0];
			opts?: { filename?: string };
		}) {
			// Mutate the current program before presets run. Replacing the
			// program from a reparse of the original source drops the import
			// `@babel/preset-react` automatic runtime has not added yet, and
			// a later replace would wipe it.
			markFile(file.ast, file.opts?.filename);
		},
	};
}
