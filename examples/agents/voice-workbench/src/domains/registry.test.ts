import { describe, expect, it, vi } from "vitest";
import type { DomainPack } from "./contracts";
import { createDomainRegistry, emptyDomainRegistry } from "./registry";

const pack = (
	id: string,
	materializeArtifact?: DomainPack["materializeArtifact"],
): DomainPack => ({
	id,
	label: id,
	capabilities: [],
	modelInstructions: "",
	appliesTo: (prompt) => prompt.includes("pricing"),
	projectExecution: () => null,
	materializeArtifact,
	auditCompletion: () => ({ ok: true }),
});

const input = {
	prompt: { channel: "text" as const, text: "Build a pricing artifact" },
	history: [],
	view: { artifacts: [] },
};

describe("domain registry artifact materialization", () => {
	it("uses identity-preserving pass-through when the registry is empty", () => {
		const call = {
			name: "createArtifact",
			input: { id: "notes", nodes: [{ kind: "text", text: "Notes" }] },
		};

		expect(emptyDomainRegistry.materializeArtifact({ ...input, call })).toBe(
			call,
		);
	});

	it("uses the first non-null materialization from an applicable pack", () => {
		const declined = vi.fn(() => null);
		const materialized = {
			id: "model-call",
			name: "createArtifact",
			input: { id: "pricing", title: "Canonical", nodes: [] },
		};
		const accepted = vi.fn(() => materialized);
		const skipped = vi.fn(() => ({
			name: "createArtifact",
			input: { id: "wrong", nodes: [] },
		}));
		const registry = createDomainRegistry([
			pack("declined", declined),
			pack("accepted", accepted),
			pack("skipped", skipped),
		]);
		const call = {
			id: "model-call",
			name: "createArtifact",
			input: { id: "pricing", title: "Proposed", nodes: [] },
		};

		expect(registry.materializeArtifact({ ...input, call })).toBe(materialized);
		expect(declined).toHaveBeenCalledOnce();
		expect(accepted).toHaveBeenCalledOnce();
		expect(skipped).not.toHaveBeenCalled();
	});

	it("preserves the proposed call when every applicable pack declines", () => {
		const registry = createDomainRegistry([pack("declined", () => null)]);
		const call = {
			name: "reviseArtifact",
			input: { artifactId: "pricing", expectedRevision: "1", nodes: [] },
		};

		expect(registry.materializeArtifact({ ...input, call })).toBe(call);
	});

	it("does not invoke materializers for generic commands or prompts", () => {
		const materializeArtifact = vi.fn(() => ({
			name: "createArtifact",
			input: { id: "wrong", nodes: [] },
		}));
		const registry = createDomainRegistry([
			pack("pricing", materializeArtifact),
		]);
		const genericCall = {
			name: "completeResponse",
			input: { text: "Done" },
		};
		const unrelatedCall = {
			name: "createArtifact",
			input: { id: "notes", nodes: [] },
		};

		expect(registry.materializeArtifact({ ...input, call: genericCall })).toBe(
			genericCall,
		);
		expect(
			registry.materializeArtifact({
				...input,
				prompt: { channel: "text", text: "Build meeting notes" },
				call: unrelatedCall,
			}),
		).toBe(unrelatedCall);
		expect(materializeArtifact).not.toHaveBeenCalled();
	});
});
