import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import routes from "../src/route-map.json" with { type: "json" };
import {
	currentRoute,
	routeUrl,
	versionDestination,
} from "../src/route-map.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(site, "dist");
function walk(dir) {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((e) =>
			e.isDirectory()
				? walk(path.join(dir, e.name))
				: e.name.endsWith(".html")
					? [path.join(dir, e.name)]
					: [],
		);
}
const html = new Map(
	walk(dist).map((file) => [
		path
			.relative(dist, file)
			.replace(/(?:^|\/)index\.html$/, "")
			.replace(/\/$/, ""),
		fs.readFileSync(file, "utf8"),
	]),
);
for (const [route, content] of html) {
	if (route === "404.html") continue;
	for (const archive of [false, true]) {
		const target = versionDestination(route, archive);
		assert.ok(
			html.has(target),
			`${route}: missing version destination ${target}`,
		);
		assert.ok(
			content.includes(`value="${routeUrl(target)}"`),
			`${route}: selector does not use ${target}`,
		);
	}
	if (route.startsWith("2.x/") || route === "2.x") {
		assert.ok(
			content.includes(`href="${routeUrl(versionDestination(route, false))}"`),
			`${route}: wrong current-version banner`,
		);
	}
}
for (const [old, target] of Object.entries(routes.redirects)) {
	const content = html.get(old);
	assert.ok(
		content?.includes(`href="${routeUrl(currentRoute(old))}"`),
		`${old}: static fallback link absent`,
	);
	assert.ok(html.has(target), `${old}: target absent`);
	for (const url of Object.values(routes.fragmentTargets[old])) {
		const [pathname, hash] = url.replace("/ignite-element/", "").split("#");
		assert.ok(
			html.get(pathname.replace(/\/$/, ""))?.includes(`id="${hash}"`),
			`missing mapped fragment ${url}`,
		);
	}
}
const small = fs.readFileSync(path.join(dist, "llms-small.txt"), "utf8");
assert.ok(
	small.split(/\s+/).length < 250,
	"agent entry index must stay concise",
);
const full = fs.readFileSync(path.join(dist, "llms-full.txt"), "utf8");
assert.ok(
	full.includes('import { igniteCore } from "ignite-element/xstate";'),
	"canonical imports must survive agent export",
);
assert.doesNotMatch(full, /Effects retain post-Ignite-render timing/);
assert.match(full, /Version: v3 \(beta\)/);
assert.doesNotMatch(
	full,
	/You are reading the Ignite Element v2 docs|LegacyRoute|<Code code=/,
);
assert.match(
	fs.readFileSync(path.join(dist, "llms-v2.txt"), "utf8"),
	/Historical v2\.2\.2 API only/,
);
const repo = path.resolve(site, "../..");
const canonical = fs
	.readFileSync(
		path.join(repo, "docs/site/src/examples/light-switch/src/light-switch.tsx"),
		"utf8",
	)
	.replaceAll("\t", "  ")
	.trim();
assert.match(canonical, /commands: \(\{ source \}\)/);
assert.match(full, /NOT available in published beta\.14/);
const historical = fs.readFileSync(
	path.join(repo, "scripts/__tests__/fixtures/handbook/beta14-toggle.tsx"),
	"utf8",
);
assert.match(historical, /commands: \(\{ actor \}\)/);
for (const file of ["README.md", "packages/ignite-element/README.md"]) {
	const readme = fs.readFileSync(path.join(repo, file), "utf8");
	assert.ok(
		readme.includes(canonical),
		`${file}: quickstart diverges from the checked candidate example`,
	);
}
for (const file of [
	"README.md",
	"packages/ignite-element/README.md",
	"examples/frameworks/react/README.md",
	"examples/frameworks/svelte/README.md",
	"examples/frameworks/vue/README.md",
	"examples/apps/form-with-validation/README.md",
]) {
	const readme = fs.readFileSync(path.join(repo, file), "utf8");
	for (const [, route] of readme.matchAll(
		/https:\/\/0xjcf\.github\.io\/ignite-element\/([^\s)#]*)/g,
	)) {
		assert.ok(
			html.has(route.replace(/\/$/, "")),
			`${file}: documentation route ${route} absent`,
		);
	}
	for (const [, dir] of readme.matchAll(
		/pnpm --dir (examples\/[a-zA-Z0-9/-]+)/g,
	)) {
		assert.ok(
			fs.existsSync(path.join(repo, dir, "package.json")),
			`${file}: run directory ${dir} absent`,
		);
	}
}
console.log(
	`Handbook: ${html.size} routes, ${Object.keys(routes.redirects).length} legacy mappings, both version directions and mapped fragments passed.`,
);

const archive = unzipSync(
	fs.readFileSync(path.join(dist, "examples/light-switch.zip")),
);
const example = path.join(site, "src/examples/light-switch");
const expectedFiles = [
	"README.md",
	"package.json",
	"index.html",
	"src/light-switch.tsx",
	"src/light-switch.css",
];
assert.deepEqual(Object.keys(archive).sort(), [...expectedFiles].sort());
for (const file of expectedFiles) {
	assert.equal(
		strFromU8(archive[file]),
		fs.readFileSync(path.join(example, file), "utf8"),
		`download differs from canonical ${file}`,
	);
}
assert.ok(
	full.includes(
		fs.readFileSync(path.join(example, "src/light-switch.tsx"), "utf8"),
	),
);
assert.ok(
	full.includes(
		fs.readFileSync(path.join(example, "src/light-switch.css"), "utf8"),
	),
);
assert.doesNotMatch(full, /<LightSwitchDemo/);
console.log(
	"Light switch download and agent export match the live example sources.",
);

const manifest = JSON.parse(
	fs.readFileSync(path.join(example, "package.json"), "utf8"),
);
assert.equal(
	manifest.dependencies["ignite-element"],
	"workspace:*",
	"preview must not silently install published beta.14",
);
assert.match(
	strFromU8(archive["README.md"]),
	/not a standalone public-package install/,
);
