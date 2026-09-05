import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateExternal } from "./check-links.mjs";

async function withServer(run) {
	const requests = [];
	const timers = new Set();
	let streamClosed;
	const closed = new Promise((resolve) => {
		streamClosed = resolve;
	});
	const server = http.createServer((req, res) => {
		requests.push(`${req.method} ${req.url}`);
		const later = (ms, fn) => {
			const timer = setTimeout(() => {
				timers.delete(timer);
				if (!res.destroyed) fn();
			}, ms);
			timers.add(timer);
			res.once("close", () => {
				clearTimeout(timer);
				timers.delete(timer);
			});
		};
		const finish = (status) => {
			res.writeHead(status);
			res.end();
		};
		if (req.url === "/reset") return req.socket.destroy();
		if (req.url === "/timeout") return later(1000, () => finish(200));
		if (req.url === "/redirect") {
			res.writeHead(302, { location: "/ok" });
			return res.end();
		}
		if (req.url === "/redirect-slow")
			return later(150, () => {
				res.writeHead(302, { location: "/timeout" });
				res.end();
			});
		if (req.url === "/shared-deadline")
			return later(150, () => finish(req.method === "HEAD" ? 405 : 200));
		if (req.url === "/404") return finish(404);
		if (req.url === "/503") return finish(503);
		if (
			req.method === "HEAD" &&
			["/405", "/501", "/fallback-fails", "/stream", "/stream-fails"].includes(
				req.url,
			)
		)
			return finish(req.url === "/501" ? 501 : 405);
		if (req.url === "/fallback-fails") return finish(500);
		if (req.url.startsWith("/stream")) {
			res.writeHead(req.url === "/stream" ? 200 : 500);
			res.write("unneeded body");
			res.once("close", streamClosed);
			return;
		}
		finish(200);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		await run({
			url: `http://127.0.0.1:${server.address().port}`,
			requests,
			closed,
		});
	} finally {
		for (const timer of timers) clearTimeout(timer);
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
		assert.equal(server.listening, false);
	}
}

for (const route of ["/ok", "/405", "/501", "/redirect"]) {
	test(`external ${route} succeeds with only the required requests`, () =>
		withServer(async ({ url, requests }) => {
			await validateExternal(url + route);
			assert.deepEqual(
				requests,
				route === "/redirect"
					? ["HEAD /redirect", "HEAD /ok"]
					: route === "/ok"
						? ["HEAD /ok"]
						: [`HEAD ${route}`, `GET ${route}`],
			);
		}));
}
for (const [route, status, methods] of [
	["/fallback-fails", 500, ["HEAD", "GET"]],
	["/404", 404, ["HEAD"]],
	["/503", 503, ["HEAD"]],
]) {
	test(`external ${route} stays an HTTP failure`, () =>
		withServer(async ({ url, requests }) => {
			await assert.rejects(
				validateExternal(url + route),
				new RegExp(`HTTP ${status}`),
			);
			assert.deepEqual(
				requests,
				methods.map((method) => `${method} ${route}`),
			);
		}));
}
test("request failure stays a failure without fallback", () =>
	withServer(async ({ url, requests }) => {
		await assert.rejects(validateExternal(`${url}/reset`));
		assert.deepEqual(requests, ["HEAD /reset"]);
	}));
for (const route of ["/timeout", "/shared-deadline", "/redirect-slow"]) {
	test(`${route} is bounded by one complete-attempt deadline`, () =>
		withServer(async ({ url, requests }) => {
			const start = performance.now();
			await assert.rejects(validateExternal(url + route, 250), /deadline/);
			assert.ok(performance.now() - start < 900);
			assert.equal(requests.length, route === "/timeout" ? 1 : 2);
		}));
}
for (const route of ["/stream", "/stream-fails"]) {
	test(`${route} releases the unused GET response body`, () =>
		withServer(async ({ url, closed }) => {
			if (route === "/stream") await validateExternal(url + route);
			else await assert.rejects(validateExternal(url + route), /HTTP 500/);
			let timer;
			try {
				await Promise.race([
					closed,
					new Promise((_, reject) => {
						timer = setTimeout(
							() => reject(new Error("body remained open")),
							1000,
						);
					}),
				]);
			} finally {
				clearTimeout(timer);
			}
		}));
}

test("successful validation clears its long deadline timer", () =>
	withServer(async ({ url }) => {
		const module = new URL("./check-links.mjs", import.meta.url).href;
		const child = spawn(
			process.execPath,
			[
				"--input-type=module",
				"-e",
				`import {validateExternal} from ${JSON.stringify(module)}; await validateExternal(${JSON.stringify(url)}, 60000);`,
			],
			{ stdio: "pipe" },
		);
		let timer;
		try {
			const exit = await Promise.race([
				once(child, "exit"),
				new Promise((_, reject) => {
					timer = setTimeout(() => {
						child.kill();
						reject(new Error("request timer retained process"));
					}, 4000);
				}),
			]);
			assert.equal(exit[0], 0);
		} finally {
			clearTimeout(timer);
			if (child.exitCode === null) {
				child.kill();
				await once(child, "exit");
			}
		}
	}));

test("ordinary internal-link CLI never requests external URLs", () =>
	withServer(async ({ url, requests }) => {
		const root = fs.mkdtempSync(
			path.join(os.tmpdir(), "internal-links-fixture-"),
		);
		let child;
		try {
			fs.mkdirSync(path.join(root, "scripts"));
			fs.mkdirSync(path.join(root, "dist"));
			fs.copyFileSync(
				new URL("./check-links.mjs", import.meta.url),
				path.join(root, "scripts/check-links.mjs"),
			);
			fs.writeFileSync(
				path.join(root, "dist/index.html"),
				`<a href="${url}/503">external</a>`,
			);
			child = spawn(
				process.execPath,
				[path.join(root, "scripts/check-links.mjs")],
				{ stdio: "pipe" },
			);
			const [code] = await once(child, "exit");
			assert.equal(code, 0);
			assert.deepEqual(requests, []);
		} finally {
			if (child && child.exitCode === null) {
				child.kill();
				await once(child, "exit");
			}
			fs.rmSync(root, { recursive: true, force: true });
		}
	}));
