import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const docs = path.join(root, "src/content/docs");
const base = "https://0xjcf.github.io/ignite-element/";
const primary = [
	"index",
	"handbook/sources",
	"handbook/views",
	"handbook/events",
	"handbook/ownership",
	"handbook/testing",
	"handbook/api",
	"handbook/examples",
];
function walk(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((e) =>
			e.isDirectory()
				? walk(path.join(dir, e.name))
				: e.name.endsWith(".mdx")
					? [path.join(dir, e.name)]
					: [],
		);
}
function title(file) {
	return (
		fs.readFileSync(file, "utf8").match(/^title: (.*)$/m)?.[1] ??
		path.basename(file)
	);
}
function content(file) {
	let text = fs.readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
	const imports = new Map(
		[...text.matchAll(/import (\w+) from ['"]([^'"]+)\?raw['"];?/g)].map(
			(m) => [m[1], path.resolve(path.dirname(file), m[2])],
		),
	);
	// Strip only MDX imports outside fences, before inserting canonical modules.
	let fenced = false;
	text = text
		.split("\n")
		.filter((line) => {
			if (/^```/.test(line)) fenced = !fenced;
			return fenced || !/^import /.test(line);
		})
		.join("\n");
	text = text.replace(
		/<Code code=\{(\w+)\} lang="(\w+)" title="([^"]+)"\s*\/>/g,
		(_, id, lang, name) =>
			`\n${name}\n\n\`\`\`${lang}\n${fs.readFileSync(imports.get(id), "utf8")}\`\`\`\n`,
	);
	return text
		.replaceAll(
			"<LightSwitchDemo />",
			"[Try the live light switch](" + base + "#build-a-component)",
		)
		.replaceAll("](/ignite-element/", `](${base}`);
}
const heading =
	"# Ignite Element\n\nVersion: v3 (beta).\nCommands receive { source }. Install ignite-element@beta with the source library you use. Stable policy: ignite-element@latest = 2.2.2.\n\n";
const index =
	heading +
	primary
		.map(
			(slug) =>
				`- [${title(path.join(docs, `${slug}.mdx`))}](${base}${slug === "index" ? "" : `${slug}/`})`,
		)
		.join("\n") +
	`\n\nHistorical v2 API: [separate archive](${base}2.x/). Never combine its API with v3 instructions.\n`;
fs.writeFileSync(path.join(root, "dist/llms.txt"), index);
fs.writeFileSync(path.join(root, "dist/llms-small.txt"), index);
const files = walk(docs).filter(
	(file) =>
		!file.includes("/2.x/") &&
		!file.endsWith("/migration/v2.mdx") &&
		!fs.readFileSync(file, "utf8").includes("LegacyRoute"),
);
fs.writeFileSync(
	path.join(root, "dist/llms-full.txt"),
	heading +
		files.map((file) => `\n# ${title(file)}\n${content(file)}`).join("\n"),
);
fs.writeFileSync(
	path.join(root, "dist/llms-v2.txt"),
	"# Ignite Element v2 archive\n\nHistorical v2.2.2 API only.\n" +
		walk(path.join(docs, "2.x"))
			.filter((file) => !fs.readFileSync(file, "utf8").includes("LegacyRoute"))
			.map(content)
			.join("\n"),
);
console.log(
	`Agent index: ${index.split(/\s+/).length} words; separate v3 and v2 exports.`,
);
