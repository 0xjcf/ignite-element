import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	expect,
	type Page,
	test,
} from "../../../packages/ignite-element/node_modules/@playwright/test/index.mjs";
import { igniteContentSecurityPolicy } from "../src/preset";
import { CSP_NONCE, matrixPage } from "./matrix-page";

/**
 * Strict gate for the xstate demo and for example documents that ship
 * a parser <style> block. Red until those pages stop violating the
 * preset. Do not weaken the empty-violation assertion.
 */

const POLICY = igniteContentSecurityPolicy(CSP_NONCE);
const STYLE_NONCE_POLICY = POLICY.replace(
	"style-src 'self'",
	`style-src 'self' 'nonce-${CSP_NONCE}'`,
);

type Violation = {
	effectiveDirective: string;
	violatedDirective: string;
	blockedURI: string;
	sourceFile: string;
	lineNumber: number;
	columnNumber: number;
	sample: string;
	disposition: string;
};

const CSP_CONSOLE =
	/content security policy|trustedhtml|trustedscript|trusted.?types|requires 'Trusted|Refused to (apply|execute|create|load|connect|frame)/i;

const STATIC_DOCUMENTS: { id: string; file: string }[] = [
	{
		id: "react-index",
		file: "../../../examples/frameworks/react/index.html",
	},
	{
		id: "svelte-index",
		file: "../../../examples/frameworks/svelte/index.html",
	},
	{
		id: "vue-index",
		file: "../../../examples/frameworks/vue/index.html",
	},
	{
		id: "form-index",
		file: "../../../examples/apps/form-with-validation/index.html",
	},
	{
		id: "voice-index",
		file: "../../../examples/agents/voice-workbench/index.html",
	},
];

function stampScripts(html: string): string {
	return html.replace(/<script\b([^>]*)>/gi, (full, attrs: string) => {
		if (/\snonce\s*=/i.test(attrs)) return full;
		return `<script nonce="${CSP_NONCE}"${attrs}>`;
	});
}

async function arm(page: Page): Promise<string[]> {
	const consoleHits: string[] = [];
	page.on("console", (message) => {
		const text = message.text();
		if (CSP_CONSOLE.test(text)) consoleHits.push(text);
	});
	await page.addInitScript(() => {
		const list: Violation[] = [];
		(window as unknown as { __cspViolations: Violation[] }).__cspViolations =
			list;
		document.addEventListener("securitypolicyviolation", (event) => {
			list.push({
				effectiveDirective: event.effectiveDirective,
				violatedDirective: event.violatedDirective,
				blockedURI: event.blockedURI,
				sourceFile: event.sourceFile,
				lineNumber: event.lineNumber,
				columnNumber: event.columnNumber,
				sample: event.sample,
				disposition: event.disposition,
			});
		});
	});
	return consoleHits;
}

async function readViolations(page: Page): Promise<Violation[]> {
	return page.evaluate(
		() =>
			(window as unknown as { __cspViolations: Violation[] }).__cspViolations,
	);
}

function summarizeConsole(lines: string[]): { key: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const line of lines) {
		const key = line.replace(/\s+/g, " ").slice(0, 180);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

function summarize(events: Violation[]): { key: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const event of events) {
		const sample = event.sample.replace(/\s+/g, " ").slice(0, 70);
		const source = event.sourceFile.replace(/\?.*$/, "");
		const key = `${event.effectiveDirective} | ${event.blockedURI} | ${source}:${event.lineNumber} | ${sample}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

test("xstate demo and example documents report no CSP or Trusted Types violations", async ({
	page,
}) => {
	const consoleHits = await arm(page);
	const pages: {
		id: string;
		ready: boolean;
		detail: string;
		violations: ReturnType<typeof summarize>;
		console: { key: string; count: number }[];
	}[] = [];

	await page.route("**/*", async (route) => {
		const request = route.request();
		if (request.resourceType() !== "document") {
			await route.continue();
			return;
		}
		const response = await route.fetch();
		const headers = response.headers();
		const type = headers["content-type"] ?? "";
		if (!type.includes("text/html")) {
			await route.fulfill({ response });
			return;
		}
		const body = stampScripts(await response.text());
		await route.fulfill({
			response,
			body,
			headers: {
				...headers,
				"content-security-policy": POLICY,
			},
		});
	});

	const demoConsoleAt = consoleHits.length;
	try {
		await page.goto("http://127.0.0.1:8091/", {
			waitUntil: "domcontentloaded",
		});
		await page.waitForSelector("my-counter-xstate", { timeout: 15_000 });
		await page.waitForTimeout(400);
		pages.push({
			id: "xstate-demo",
			ready: true,
			detail: "my-counter-xstate mounted",
			violations: summarize(await readViolations(page)),
			console: summarizeConsole(consoleHits.slice(demoConsoleAt)),
		});
	} catch (error) {
		pages.push({
			id: "xstate-demo",
			ready: false,
			detail: error instanceof Error ? error.message : String(error),
			violations: summarize(await readViolations(page).catch(() => [])),
			console: summarizeConsole(consoleHits.slice(demoConsoleAt)),
		});
	}

	for (const document of STATIC_DOCUMENTS) {
		const started = consoleHits.length;
		const html = readFileSync(
			fileURLToPath(new URL(document.file, import.meta.url)),
			"utf8",
		);
		const url = `http://127.0.0.1:8091/__csp/${document.id}.html`;
		await page.unroute("**/*").catch(() => undefined);
		await page.route(url, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/html; charset=utf-8",
				headers: { "content-security-policy": POLICY },
				body: stampScripts(html),
			});
		});
		await page.route(/\/__csp\/.*\.(tsx|js|css)$/, async (route) => {
			await route.fulfill({ status: 404, body: "" });
		});
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(200);
		pages.push({
			id: document.id,
			ready: true,
			detail: document.file,
			violations: summarize(await readViolations(page)),
			console: summarizeConsole(consoleHits.slice(started)),
		});
	}

	const offender = pages.find(
		(entry) =>
			!entry.ready || entry.violations.length > 0 || entry.console.length > 0,
	);
	expect(offender, JSON.stringify(pages, null, 2)).toBeUndefined();
});

type MatrixRow = {
	id: string;
	threw: boolean;
	error: string | null;
	note: string | null;
	directives: string[];
};

async function runMatrix(page: Page, policy: string): Promise<MatrixRow[]> {
	await arm(page);
	const htmlUrl = "http://127.0.0.1:8091/csp-matrix.html";
	await page.route(htmlUrl, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "text/html; charset=utf-8",
			headers: { "content-security-policy": policy },
			body: matrixPage(CSP_NONCE),
		});
	});
	await page.route("http://127.0.0.1:8091/csp-matrix.css", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "text/css; charset=utf-8",
			body: ".spike-external { color: green }",
		});
	});
	await page.goto(htmlUrl, { waitUntil: "domcontentloaded" });
	await page.waitForFunction(
		() => (window as unknown as { __cspDone?: boolean }).__cspDone,
	);
	const report = await page.evaluate(
		() =>
			(
				window as unknown as {
					__cspReport: {
						id: string;
						error: string | null;
						note: unknown;
						events: { directive: string }[];
					}[];
				}
			).__cspReport,
	);
	return report.map((row) => ({
		id: row.id,
		threw: row.error !== null,
		error: row.error,
		note: row.note === undefined || row.note === null ? null : String(row.note),
		directives: row.events.map((event) => event.directive),
	}));
}

type MatrixFact = {
	id: string;
	threw: boolean;
	directives: string[];
	note: string | null;
	errorName: string | null;
};

function matrixFact(row: MatrixRow): MatrixFact {
	return {
		id: row.id,
		threw: row.threw,
		directives: row.directives,
		note: row.note,
		errorName: row.error === null ? null : (row.error.split(":")[0] ?? null),
	};
}

/**
 * Chromium 143, preset header. cssText and setProperty apply and do
 * not report. A style element and a style attribute do not apply.
 * Constructable stylesheets apply. Trusted Types rejects the HTML
 * sinks and the lit-html policy name. A TrustedScript still loses to
 * script-src because 'unsafe-eval' is absent.
 */
const MATRIX_UNDER_PRESET: MatrixFact[] = [
	{
		id: "external-link",
		threw: false,
		directives: [],
		note: "rgb(0, 128, 0)",
		errorName: null,
	},
	{
		id: "style-element",
		threw: false,
		directives: ["style-src-elem"],
		note: "rgb(0, 0, 0)",
		errorName: null,
	},
	{
		id: "style-element-nonce",
		threw: false,
		directives: ["style-src-elem"],
		note: "rgb(0, 0, 0)",
		errorName: null,
	},
	{
		id: "style-attribute",
		threw: false,
		directives: ["style-src-attr"],
		note: "rgb(0, 0, 0)",
		errorName: null,
	},
	{
		id: "css-text",
		threw: false,
		directives: [],
		note: "red computed rgb(255, 0, 0)",
		errorName: null,
	},
	{
		id: "set-property",
		threw: false,
		directives: [],
		note: "red computed rgb(255, 0, 0)",
		errorName: null,
	},
	{
		id: "adopted-replace-sync",
		threw: false,
		directives: [],
		note: "rgb(255, 0, 0)",
		errorName: null,
	},
	{
		id: "adopted-insert-rule",
		threw: false,
		directives: [],
		note: null,
		errorName: null,
	},
	{
		id: "adopted-replace",
		threw: false,
		directives: [],
		note: null,
		errorName: null,
	},
	{
		id: "inner-html",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "outer-html",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "insert-adjacent-html",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "create-contextual-fragment",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "iframe-srcdoc",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "eval-call",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "EvalError",
	},
	{
		id: "new-function",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "EvalError",
	},
	{
		id: "string-set-timeout",
		threw: true,
		directives: ["require-trusted-types-for"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "document-write",
		threw: true,
		directives: [],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "policy-lit-html",
		threw: true,
		directives: ["trusted-types"],
		note: null,
		errorName: "TypeError",
	},
	{
		id: "policy-ignite-inner-html",
		threw: false,
		directives: [],
		note: "<b>ok</b>",
		errorName: null,
	},
	{
		id: "policy-ignite-eval",
		threw: true,
		directives: ["script-src"],
		note: null,
		errorName: "EvalError",
	},
];

test("style and sink matrix matches the preset on Chromium", async ({
	page,
}) => {
	const observed = (await runMatrix(page, POLICY)).map(matrixFact);
	expect(observed, JSON.stringify(observed, null, 2)).toEqual(
		MATRIX_UNDER_PRESET,
	);
});

test("matrix with a style nonce allows only the nonced style element", async ({
	page,
}) => {
	const observed = await runMatrix(page, STYLE_NONCE_POLICY);
	const byId = new Map(observed.map((row) => [row.id, row]));
	expect(byId.get("style-element-nonce")).toMatchObject({
		directives: [],
		note: "rgb(0, 0, 255)",
		threw: false,
	});
	expect(byId.get("style-element")).toMatchObject({
		directives: ["style-src-elem"],
		note: "rgb(0, 0, 0)",
	});
	expect(byId.get("style-attribute")?.directives).toEqual(["style-src-attr"]);
	expect(byId.get("css-text")?.note).toBe("red computed rgb(255, 0, 0)");
	expect(byId.get("adopted-replace-sync")?.note).toBe("rgb(255, 0, 0)");
});
