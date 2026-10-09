import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const bundlePath = path.resolve(process.argv[2]);
const writeOut = process.stdout.write.bind(process.stdout);
const require = createRequire(
	new URL("../../../packages/ignite-element/package.json", import.meta.url),
);
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!DOCTYPE html><body></body>", {
	url: "https://example.test/",
});
const { window } = dom;
const warnings = [];
window.console.warn = (...args) => {
	warnings.push(args.map(String).join(" "));
};

// jsdom's globalThis can still see Node's process. Drop the global entirely.
// Do not install a `process.env` stub.
Reflect.deleteProperty(globalThis, "process");
const context = vm.createContext(window);
vm.runInContext("delete globalThis.process", context);
const processType = vm.runInContext("typeof process", context);
const globalProcessType = vm.runInContext("typeof globalThis.process", context);
if (processType !== "undefined" || globalProcessType !== "undefined") {
	throw new Error(
		`browser realm still has process (free ${processType}, global ${globalProcessType})`,
	);
}
const cache = new Map();

async function load(fileUrl) {
	const existing = cache.get(fileUrl.href);
	if (existing) return existing;
	const filePath = fileUrl.pathname;
	const mod = new vm.SourceTextModule(readFileSync(filePath, "utf8"), {
		identifier: fileUrl.href,
		context,
		initializeImportMeta(meta) {
			meta.url = fileUrl.href;
		},
	});
	cache.set(fileUrl.href, mod);
	await mod.link(async (specifier, referencing) => {
		const resolved = new URL(specifier, referencing.identifier);
		return load(resolved);
	});
	await mod.evaluate();
	return mod;
}

const entry = await load(pathToFileURL(bundlePath));
const { jsx, mountIgniteJsxOnce } = entry.namespace;
const host = window.document.createElement("div");
mountIgniteJsxOnce(
	host,
	jsx("div", {
		children: [
			jsx("span", { children: "one" }, "dup"),
			jsx("span", { children: "two" }, "dup"),
		],
	}),
);
mountIgniteJsxOnce(
	window.document.createElement("div"),
	jsx("div", { innerHTML: "<p>rich</p>" }),
);
mountIgniteJsxOnce(
	window.document.createElement("div"),
	jsx("div", { textContent: "plain" }),
);

writeOut(
	`${JSON.stringify({ text: host.textContent, warnings, processType })}\n`,
);
