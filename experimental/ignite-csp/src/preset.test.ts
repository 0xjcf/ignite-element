import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { igniteContentSecurityPolicy } from "./preset";
import { subresourceIntegrity } from "./sri";
import {
	acknowledgeContentSecurityPolicy,
	warnIfNoContentSecurityPolicy,
} from "./warn";

const require = createRequire(
	fileURLToPath(
		new URL("../../../node_modules/vite/package.json", import.meta.url),
	),
);

describe("igniteContentSecurityPolicy", () => {
	it("builds a nonce policy without unsafe-inline or unsafe-eval", () => {
		const header = igniteContentSecurityPolicy("spikeNonce1");
		expect(header).toBe(
			[
				"script-src 'nonce-spikeNonce1' 'strict-dynamic'",
				"object-src 'none'",
				"base-uri 'none'",
				"style-src 'self'",
				"require-trusted-types-for 'script'",
				"trusted-types ignite",
			].join("; "),
		);
		expect(header).not.toContain("unsafe-inline");
		expect(header).not.toContain("unsafe-eval");
	});

	it("rejects a nonce that could break the header", () => {
		expect(() => igniteContentSecurityPolicy("bad nonce")).toThrow(/nonce/);
		expect(() => igniteContentSecurityPolicy("short")).toThrow(/nonce/);
		expect(() => igniteContentSecurityPolicy("quote'break")).toThrow(/nonce/);
	});
});

describe("subresourceIntegrity", () => {
	it("matches the openssl sha384 base64 form for the bytes of ignite", () => {
		expect(subresourceIntegrity(new TextEncoder().encode("ignite"))).toBe(
			"sha384-Lb7epFGu01ixC18guolylvFz9IBqy7CZMwaq7qo13p98axnrT1KOfklEzHVoFWhB",
		);
	});
});

describe("warnIfNoContentSecurityPolicy", () => {
	it("stays quiet when a meta policy is present", () => {
		const warnings: string[] = [];
		const previousDocument = (globalThis as { document?: unknown }).document;
		const previousWarn = console.warn;
		(globalThis as { document?: unknown }).document = {
			querySelector: () => ({ getAttribute: () => "script-src 'self'" }),
		};
		console.warn = (message?: unknown) => {
			warnings.push(String(message));
		};
		try {
			warnIfNoContentSecurityPolicy();
			expect(warnings).toEqual([]);
		} finally {
			console.warn = previousWarn;
			if (previousDocument === undefined) {
				delete (globalThis as { document?: unknown }).document;
			} else {
				(globalThis as { document?: unknown }).document = previousDocument;
			}
		}
	});

	it("warns once until the host acknowledges a header", () => {
		const warnings: string[] = [];
		const doc = {
			querySelector: () => null,
		};
		const previousDocument = (globalThis as { document?: unknown }).document;
		const previousWarn = console.warn;
		(globalThis as { document?: unknown }).document = doc;
		console.warn = (message?: unknown) => {
			warnings.push(String(message));
		};
		try {
			warnIfNoContentSecurityPolicy();
			warnIfNoContentSecurityPolicy();
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Content-Security-Policy");
			acknowledgeContentSecurityPolicy();
			warnIfNoContentSecurityPolicy();
			expect(warnings).toHaveLength(1);
		} finally {
			console.warn = previousWarn;
			if (previousDocument === undefined) {
				delete (globalThis as { document?: unknown }).document;
			} else {
				(globalThis as { document?: unknown }).document = previousDocument;
			}
		}
	});
});

type Esbuild = {
	build(options: {
		stdin: {
			contents: string;
			resolveDir: string;
			sourcefile: string;
			loader: "ts";
		};
		bundle: boolean;
		write: false;
		minify: boolean;
		format: "esm";
		define: Record<string, string>;
	}): Promise<{ outputFiles: { text: string }[] }>;
};

describe("production dead-code elimination", () => {
	it("drops the warning when __IGNITE_DEV_WARNINGS__ is false", async () => {
		const esbuild = require("esbuild") as Esbuild;
		const warnPath = fileURLToPath(new URL("./warn.ts", import.meta.url));
		const entry = [
			`import { acknowledgeContentSecurityPolicy, warnIfNoContentSecurityPolicy } from ${JSON.stringify(warnPath)};`,
			"acknowledgeContentSecurityPolicy();",
			"warnIfNoContentSecurityPolicy();",
		].join("\n");
		const silent = await esbuild.build({
			stdin: {
				contents: entry,
				resolveDir: fileURLToPath(new URL(".", import.meta.url)),
				sourcefile: "entry.ts",
				loader: "ts",
			},
			bundle: true,
			write: false,
			minify: true,
			format: "esm",
			define: { __IGNITE_DEV_WARNINGS__: "false" },
		});
		const silentCode = silent.outputFiles[0]?.text ?? "";
		expect(silentCode).not.toMatch(
			/document|console|querySelector|Content-Security-Policy|acknowledged|warned/,
		);

		const loud = await esbuild.build({
			stdin: {
				contents: entry,
				resolveDir: fileURLToPath(new URL(".", import.meta.url)),
				sourcefile: "entry.ts",
				loader: "ts",
			},
			bundle: true,
			write: false,
			minify: true,
			format: "esm",
			define: { __IGNITE_DEV_WARNINGS__: "true" },
		});
		const loudCode = loud.outputFiles[0]?.text ?? "";
		expect(loudCode).toContain("Content-Security-Policy");
		expect(loudCode).toContain("querySelector");
	});
});
