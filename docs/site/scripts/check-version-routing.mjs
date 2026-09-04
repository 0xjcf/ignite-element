import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const docsRoot = path.join(siteRoot, "src/content/docs");
const builtRoot = path.join(siteRoot, "dist");

const requiredCurrentRoutes = [
	"index",
	"getting-started/installation",
	"getting-started/first-component",
	"concepts/the-ignite-model",
	"concepts/rendering",
	"api/ignite-core",
	"api/headless-runtime",
	"api/command-metadata",
	"api/testing-dsl",
	"api/advanced-config",
	"api/compatibility",
	"guides/host-app-integration",
	"guides/agent-runtime-v3",
	"guides/redux-and-mobx",
	"guides/routing",
	"guides/actor-web",
	"guides/styling",
	"guides/testing",
	"migration/v3",
];

const requiredArchivedRoutes = [
	"2.x/index",
	"2.x/getting-started/installation",
	"2.x/getting-started/first-component",
	"2.x/api/ignite-core",
];

const read = (relativePath) =>
	fs.readFileSync(path.join(siteRoot, relativePath), "utf8");

const routeSource = (route) => {
	const base = path.join(docsRoot, route);
	for (const candidate of [
		`${base}.mdx`,
		`${base}.md`,
		path.join(base, "index.mdx"),
	]) {
		if (fs.existsSync(candidate)) return candidate;
	}
	return undefined;
};

const walk = (directory, suffix) => {
	const result = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...walk(absolute, suffix));
		else if (absolute.endsWith(suffix)) result.push(absolute);
	}
	return result.sort();
};

const config = read("astro.config.mjs");
assert.match(
	config,
	/starlightVersions\s*\(/,
	"version plugin must be configured",
);
assert.match(
	config,
	/current:\s*\{\s*label:\s*["']v3 \(beta\)["']\s*\}/,
	"current docs must be labeled v3 (beta)",
);
assert.match(
	config,
	/versions:\s*\[\s*\{\s*slug:\s*["']2\.x["'],\s*label:\s*["']2\.x["']\s*\}\s*\]/,
	"the frozen 2.x archive must be registered",
);
assert.match(
	config,
	/SiteTitle:\s*["']\.\/src\/components\/SiteTitle\.astro["']/,
	"version-aware site title must be persistent chrome",
);
assert.match(
	config,
	/routeMiddleware:\s*["']\.\/src\/starlightRouteData\.ts["']/,
	"route-specific stable branding must be configured",
);
assert.match(
	config,
	/exclude:\s*\[\s*["']2\.x\/\*\*["']\s*\]/,
	"small LLM output must exclude the v2 archive",
);

for (const route of [...requiredCurrentRoutes, ...requiredArchivedRoutes]) {
	assert.ok(routeSource(route), `missing documentation route source: ${route}`);
}

assert.ok(
	fs.existsSync(path.join(siteRoot, "src/content/versions/2.x.json")),
	"missing frozen 2.x sidebar data",
);
assert.ok(
	fs.existsSync(path.join(siteRoot, "src/components/SiteTitle.astro")),
	"missing version-aware site title",
);
assert.ok(
	fs.existsSync(
		path.join(siteRoot, "public/ignite-element-favicon-stable.svg"),
	),
	"missing stable-v2 favicon",
);

const installation = fs.readFileSync(
	routeSource("getting-started/installation"),
	"utf8",
);
assert.match(
	installation,
	/ignite-element@(?:beta|3\.0\.0-beta\.11)/,
	"v3 install must select beta.11",
);
assert.match(
	installation,
	/ignite-element@latest[^\n]*2\.2\.2|latest[^\n]*ignite-element[^\n]*2\.2\.2/i,
	"stable facade policy must name ignite-element@latest = 2.2.2",
);
assert.doesNotMatch(
	installation,
	/production[- ]stable|stable v3/i,
	"v3 must not be described as stable",
);

const archivedInstallation = fs.readFileSync(
	routeSource("2.x/getting-started/installation"),
	"utf8",
);
assert.doesNotMatch(
	archivedInstallation,
	/@beta|3\.0\.0-beta/,
	"v2 install must not select beta packages",
);

for (const file of walk(docsRoot, ".mdx")) {
	const relative = path.relative(docsRoot, file);
	const content = fs.readFileSync(file, "utf8");
	if (relative.startsWith(`2.x${path.sep}`)) {
		assert.doesNotMatch(
			content,
			/ignite-element@beta|3\.0\.0-beta\.11/,
			`v3 package leaked into ${relative}`,
		);
		continue;
	}
	for (const line of content.split("\n")) {
		if (/\b(?:pnpm add|npm install|yarn add)\s+ignite-element\b/.test(line)) {
			assert.match(
				line,
				/ignite-element@(?:beta|3\.0\.0-beta\.11)/,
				`untagged v3 install in ${relative}: ${line.trim()}`,
			);
		}
	}
	assert.doesNotMatch(
		content,
		/github\.com\/0xjcf\/ignite-element\/(?:tree|blob)\/main\//,
		`mutable main link in ${relative}`,
	);
	assert.doesNotMatch(
		content,
		/3\.0\.0-(?:beta\.(?:1[2-9]|[2-9]\d)|rc\.)/,
		`unpublished v3 artifact in ${relative}`,
	);
}

if (process.argv.includes("--built")) {
	assert.ok(
		fs.existsSync(builtRoot),
		"built site is required for --built validation",
	);
	const routeFile = (route) => {
		const routeDirectory =
			route === "index" ? "" : route.replace(/\/index$/, "");
		return path.join(builtRoot, routeDirectory, "index.html");
	};
	const routeUrl = (route) => {
		const pathname = route === "index" ? "" : route.replace(/\/index$/, "");
		return `/ignite-element/${pathname ? `${pathname}/` : ""}`;
	};
	for (const route of [...requiredCurrentRoutes, ...requiredArchivedRoutes]) {
		assert.ok(
			fs.existsSync(routeFile(route)),
			`missing built route: ${routeUrl(route)}`,
		);
	}

	for (const route of requiredCurrentRoutes) {
		const html = fs.readFileSync(routeFile(route), "utf8");
		assert.match(
			html,
			/v3 \(beta\)/,
			`built v3 route lacks persistent beta disclosure: ${route}`,
		);
		assert.match(
			html,
			new RegExp(
				`<link rel="canonical" href="https://0xjcf\\.github\\.io${routeUrl(route)}"\\s*/?>`,
			),
			`wrong canonical URL: ${route}`,
		);
	}

	for (const route of requiredArchivedRoutes) {
		const html = fs.readFileSync(routeFile(route), "utf8");
		assert.match(
			html,
			/2\.x/,
			`built archived route lacks stable-v2 identification: ${route}`,
		);
	}

	const builtPages = walk(builtRoot, ".html");
	const archivedPages = builtPages.filter((file) =>
		path.relative(builtRoot, file).startsWith(`2.x${path.sep}`),
	);
	const currentPages = builtPages.filter(
		(file) => !archivedPages.includes(file),
	);
	for (const file of currentPages) {
		const relative = path.relative(builtRoot, file);
		const html = fs.readFileSync(file, "utf8");
		assert.match(
			html,
			/v3 \(beta\)/,
			`v3 beta chrome missing from ${relative}`,
		);
		assert.match(
			html,
			/href="\/ignite-element\/ignite-element-favicon\.svg"/,
			`v3 beta favicon missing from ${relative}`,
		);
	}
	for (const file of archivedPages) {
		const relative = path.relative(builtRoot, file);
		const html = fs.readFileSync(file, "utf8");
		assert.match(
			html,
			/>\s*2\.x\s*<\/option>/,
			`2.x selector missing from ${relative}`,
		);
		assert.match(
			html,
			/href="\/ignite-element\/ignite-element-favicon-stable\.svg"/,
			`stable-v2 favicon missing from ${relative}`,
		);
		assert.match(
			html,
			/ignite-element-logo-stable(?:-light)?\.[A-Za-z0-9_-]+\.svg/,
			`stable-v2 logo missing from ${relative}`,
		);
	}

	const smallLlms = path.join(builtRoot, "llms-small.txt");
	assert.ok(fs.existsSync(smallLlms), "missing llms-small.txt");
	const smallLlmsContent = fs.readFileSync(smallLlms, "utf8");
	assert.doesNotMatch(
		smallLlmsContent,
		/\/2\.x\//,
		"llms-small.txt must exclude frozen v2 pages",
	);
	assert.match(
		smallLlmsContent,
		/v3 \(beta\)/,
		"llms-small.txt must identify v3 as beta",
	);
	assert.match(
		smallLlmsContent,
		/ignite-element@latest = 2\.2\.2/,
		"llms-small.txt must preserve the stable facade policy",
	);

	const fullLlms = path.join(builtRoot, "llms-full.txt");
	assert.ok(fs.existsSync(fullLlms), "missing llms-full.txt");
	const fullLlmsContent = fs.readFileSync(fullLlms, "utf8");
	assert.match(
		fullLlmsContent,
		/v3 \(beta\)/,
		"llms-full.txt must identify v3 as beta",
	);
	assert.match(
		fullLlmsContent,
		/reading the Ignite Element v2 docs/,
		"llms-full.txt must identify the frozen v2 archive",
	);
}

console.log(
	JSON.stringify({
		status: "verified-version-routing-contract",
		currentRoutes: requiredCurrentRoutes.length,
		archivedRoutes: requiredArchivedRoutes.length,
		built: process.argv.includes("--built"),
	}),
);
