import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const entries = [
	"unplugin",
	"vite",
	"rollup",
	"webpack",
	"rspack",
	"esbuild",
	"rolldown",
	"babel",
	"typescript",
];

for (const name of entries) {
	await build({
		entryPoints: [`src/${name}.ts`],
		outfile: `dist/${name}.cjs`,
		bundle: true,
		platform: "node",
		format: "cjs",
		target: "node20",
		external: [
			"unplugin",
			"typescript",
			"@babel/generator",
			"@babel/parser",
			"@babel/traverse",
			"@babel/types",
		],
		logLevel: "silent",
	});
	const file = `dist/${name}.cjs`;
	const text = readFileSync(file, "utf8").replace(
		/\nmodule\.exports = \w+;\s*$/,
		"\n",
	);
	const named = text.match(new RegExp(`var (${name}_default) =`));
	const fallback = text.match(/default: \(\) => (\w+)/);
	const binding = named?.[1] ?? fallback?.[1];
	if (!binding) throw new Error(`No CommonJS export binding for ${name}`);
	writeFileSync(file, `${text.trimEnd()}\nmodule.exports = ${binding};\n`);
}
