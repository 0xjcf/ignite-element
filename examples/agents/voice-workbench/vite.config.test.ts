import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	createVoiceWorkbenchViteConfig,
	handleWebSearchCapabilityRequest,
	MAX_CAPABILITY_REQUEST_BYTES,
	readCapabilityRequestBody,
	resolveVoiceWorkbenchServerEnvironment,
} from "./vite.config";

describe("voice workbench Vite capability boundary", () => {
	it("loads the ignored example-local env while preserving shell overrides", async () => {
		const envDir = await mkdtemp(join(tmpdir(), "voice-workbench-env-"));
		try {
			await writeFile(
				join(envDir, ".env.local"),
				"BRAVE_SEARCH_API_KEY=local-secret\n",
			);

			expect(
				resolveVoiceWorkbenchServerEnvironment(
					{ mode: "development" },
					{ envDir, processEnv: {} },
				),
			).toEqual({ braveSearchApiKey: "local-secret" });
			expect(
				resolveVoiceWorkbenchServerEnvironment(
					{ mode: "development" },
					{
						envDir,
						processEnv: { BRAVE_SEARCH_API_KEY: "shell-secret" },
					},
				),
			).toEqual({ braveSearchApiKey: "shell-secret" });
		} finally {
			await rm(envDir, { recursive: true, force: true });
		}
	});

	it("publishes only availability while the route keeps the Brave key server-side", async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }),
		);
		const config = createVoiceWorkbenchViteConfig({
			braveSearchApiKey: "server-secret",
			fetch: fetchMock,
		});

		expect(config.define).toEqual({
			__VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__: "true",
		});
		expect(JSON.stringify(config.define)).not.toContain("server-secret");
		expect(config.plugins).toEqual([
			expect.objectContaining({ name: "voice-workbench-capabilities" }),
		]);

		await expect(
			handleWebSearchCapabilityRequest(
				{
					method: "POST",
					body: JSON.stringify({
						queries: ["coffee"],
						countPerQuery: 3,
					}),
				},
				{ apiKey: "server-secret", fetch: fetchMock },
			),
		).resolves.toMatchObject({
			status: 200,
			body: { type: "success", toolName: "searchWeb" },
		});
		expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
			"X-Subscription-Token": "server-secret",
		});
	});

	it("omits search from browser admission and returns an unavailable fact without a key", async () => {
		const fetchMock = vi.fn();
		const config = createVoiceWorkbenchViteConfig({
			braveSearchApiKey: "",
			fetch: fetchMock,
		});
		expect(config.define).toEqual({
			__VOICE_WORKBENCH_WEB_SEARCH_AVAILABLE__: "false",
		});
		await expect(
			handleWebSearchCapabilityRequest(
				{ method: "POST", body: JSON.stringify({ queries: ["coffee"] }) },
				{ apiKey: "", fetch: fetchMock },
			),
		).resolves.toMatchObject({
			status: 200,
			body: {
				type: "unavailable",
				message: "Web search is not configured for this workbench.",
			},
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects non-POST and malformed requests at the server route", async () => {
		await expect(
			handleWebSearchCapabilityRequest(
				{ method: "GET", body: "" },
				{ apiKey: "key" },
			),
		).resolves.toMatchObject({ status: 405 });
		await expect(
			handleWebSearchCapabilityRequest(
				{ method: "POST", body: "not-json" },
				{ apiKey: "key" },
			),
		).resolves.toMatchObject({
			status: 400,
			body: { type: "validation" },
		});
	});

	it("rejects oversized capability bodies before buffering later chunks", async () => {
		const observed: string[] = [];
		async function* chunks() {
			observed.push("bounded");
			yield new Uint8Array(MAX_CAPABILITY_REQUEST_BYTES);
			observed.push("overflow");
			yield new Uint8Array(1);
			observed.push("unread");
			yield new Uint8Array(1);
		}

		await expect(readCapabilityRequestBody(chunks())).resolves.toEqual({
			ok: false,
			reason: "too-large",
		});
		expect(observed).toEqual(["bounded", "overflow"]);
		await expect(
			handleWebSearchCapabilityRequest(
				{
					method: "POST",
					body: "x".repeat(MAX_CAPABILITY_REQUEST_BYTES + 1),
				},
				{ apiKey: "key" },
			),
		).resolves.toMatchObject({
			status: 413,
			body: {
				type: "validation",
				message: "The web search request is too large.",
			},
		});
	});
});
