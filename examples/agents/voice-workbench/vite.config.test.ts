import { describe, expect, it, vi } from "vitest";
import {
	createVoiceWorkbenchViteConfig,
	handleWebSearchCapabilityRequest,
} from "./vite.config";

describe("voice workbench Vite capability boundary", () => {
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
});
