import type { NeutralManifest } from "ignite-element/tools";
import { describe, expect, it, vi } from "vitest";
import {
	type CapabilityOwner,
	createCapabilityFederation,
	runCapability,
} from "./capability-federation";

const manifest = (name: string): NeutralManifest => [
	{
		name,
		description: `Run ${name}`,
		inputSchema: {
			type: "object",
			properties: { query: { type: "string" } },
			required: ["query"],
			additionalProperties: false,
		},
		gated: false,
	},
];

const owner = (id: string, toolName: string): CapabilityOwner => ({
	id,
	manifest: manifest(toolName),
	run: vi.fn(async (call) => ({
		type: "success" as const,
		ownerId: id,
		toolName: call.name,
		data: { query: (call.input as { query: string }).query, results: [] },
		receipt: { provider: id, sourceCount: 0 },
	})),
});

describe("voice workbench capability federation", () => {
	it("builds a collision-safe owner index and routes calls only to their owner", async () => {
		const actor = owner("workbench-component", "createArtifact");
		const search = owner("web-search", "searchWeb");
		const federation = createCapabilityFederation([actor, search]);

		expect(federation).toMatchObject({
			ok: true,
			manifest: [{ name: "createArtifact" }, { name: "searchWeb" }],
		});
		if (!federation.ok) throw new Error("expected a ready federation");

		await expect(
			runCapability(federation, {
				id: "search-1",
				name: "searchWeb",
				input: { query: "typical grocery prices" },
			}),
		).resolves.toMatchObject({
			type: "success",
			ownerId: "web-search",
			toolName: "searchWeb",
		});
		expect(search.run).toHaveBeenCalledOnce();
		expect(actor.run).not.toHaveBeenCalled();
	});

	it("rejects duplicate tool names before any provider can execute", () => {
		const first = owner("first", "searchWeb");
		const second = owner("second", "searchWeb");
		const federation = createCapabilityFederation([first, second]);

		expect(federation).toEqual({
			ok: false,
			error: {
				type: "collision",
				toolNames: ["searchWeb"],
				owners: ["first", "second"],
			},
		});
		expect(first.run).not.toHaveBeenCalled();
		expect(second.run).not.toHaveBeenCalled();
	});

	it("returns unknown and provider failures as structured facts", async () => {
		const failing: CapabilityOwner = {
			id: "failing-provider",
			manifest: manifest("searchWeb"),
			run: async () => ({
				type: "provider-failure",
				ownerId: "failing-provider",
				toolName: "searchWeb",
				message: "Search is temporarily unavailable.",
			}),
		};
		const federation = createCapabilityFederation([failing]);
		if (!federation.ok) throw new Error("expected a ready federation");

		await expect(
			runCapability(federation, {
				name: "searchWeb",
				input: { query: "coffee" },
			}),
		).resolves.toMatchObject({
			type: "provider-failure",
			ownerId: "failing-provider",
		});
		await expect(
			runCapability(federation, { name: "notAdvertised", input: {} }),
		).resolves.toEqual({
			type: "unavailable",
			ownerId: "federation",
			toolName: "notAdvertised",
			message: "The capability is not available in this turn.",
		});
	});

	it("contains unexpected provider throws as failure facts", async () => {
		const throwing: CapabilityOwner = {
			id: "throwing-provider",
			manifest: manifest("searchWeb"),
			run: async () => {
				throw new Error("secret adapter failure");
			},
		};
		const federation = createCapabilityFederation([throwing]);
		if (!federation.ok) throw new Error("expected a ready federation");

		await expect(
			runCapability(federation, {
				name: "searchWeb",
				input: { query: "coffee" },
			}),
		).resolves.toEqual({
			type: "provider-failure",
			ownerId: "throwing-provider",
			toolName: "searchWeb",
			message: "The capability provider failed unexpectedly.",
		});
	});

	it("normalizes a provider result that settles after cancellation to timeout", async () => {
		let resolveProvider!: (
			value: Awaited<ReturnType<CapabilityOwner["run"]>>,
		) => void;
		const providerSignal = vi.fn<(signal: AbortSignal) => void>();
		const deferred: CapabilityOwner = {
			id: "deferred-provider",
			manifest: manifest("searchWeb"),
			run: (_call, signal) => {
				providerSignal(signal);
				return new Promise((resolve) => {
					resolveProvider = resolve;
				});
			},
		};
		const federation = createCapabilityFederation([deferred]);
		if (!federation.ok) throw new Error("expected a ready federation");
		const controller = new AbortController();

		const execution = runCapability(
			federation,
			{ name: "searchWeb", input: { query: "coffee" } },
			controller.signal,
		);
		controller.abort();
		resolveProvider({
			type: "success",
			ownerId: "deferred-provider",
			toolName: "searchWeb",
			data: { results: [] },
			receipt: { provider: "deferred-provider" },
		});

		await expect(execution).resolves.toEqual({
			type: "timeout",
			ownerId: "deferred-provider",
			toolName: "searchWeb",
			message: "The capability execution was cancelled.",
		});
		expect(providerSignal).toHaveBeenCalledWith(controller.signal);
		expect(providerSignal.mock.calls[0]?.[0].aborted).toBe(true);
	});

	it("preserves structured retry and cache provenance while enforcing owner identity", async () => {
		const retrying: CapabilityOwner = {
			id: "trusted-owner",
			manifest: manifest("searchWeb"),
			run: async () => ({
				type: "provider-failure",
				ownerId: "spoofed-owner",
				toolName: "spoofed-tool",
				message: "Rate limited.",
				status: 429,
				retry: {
					attempts: 2,
					maxAttempts: 2,
					retryAfterMs: 500,
					exhausted: true,
				},
			}),
		};
		const federation = createCapabilityFederation([retrying]);
		if (!federation.ok) throw new Error("expected a ready federation");

		await expect(
			runCapability(federation, {
				name: "searchWeb",
				input: { query: "coffee" },
			}),
		).resolves.toEqual({
			type: "provider-failure",
			ownerId: "trusted-owner",
			toolName: "searchWeb",
			message: "Rate limited.",
			status: 429,
			retry: {
				attempts: 2,
				maxAttempts: 2,
				retryAfterMs: 500,
				exhausted: true,
			},
		});
	});
});
