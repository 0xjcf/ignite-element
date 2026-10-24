import { parse } from "@babel/parser";
import type { Program } from "@babel/types";
import { transformSource } from "./transform.js";

const seen = new WeakSet<object>();

export default function igniteJsxBabel() {
	return {
		name: "ignite-jsx",
		visitor: {
			Program: {
				exit(
					path: { replaceWith: (node: Program) => void },
					state: { file: { code: string }; filename?: string },
				) {
					if (seen.has(state)) return;
					seen.add(state);
					const original = state.file.code;
					const next = transformSource(original, state.filename ?? "input.tsx");
					if (next === original) return;
					const ast = parse(next, {
						sourceType: "module",
						plugins: ["typescript", "jsx"],
					});
					path.replaceWith(ast.program);
				},
			},
		},
	};
}
