// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
	applyProjectionDocumentPatch,
	parseProjectionDocument,
	validateProjectionDocument,
} from "./artifact-document";

const parameters = { seed: 1801028, numRuns: 100 };
const context = { schema: { commands: {} }, canExecute: () => false };

describe("target removal preservation properties", () => {
	it("validates and copies documents; stale patches never change their source", () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1 }),
				fc.integer({ min: 1, max: 1000 }),
				(text, revision) => {
					const original = {
						id: "workout",
						revision: String(revision),
						nodes: [{ kind: "text", id: "summary", text }],
					};
					const parsed = parseProjectionDocument(original);
					expect(parsed.ok).toBe(true);
					if (!parsed.ok) return;
					expect(parsed.document).toEqual(original);
					expect(parsed.document).not.toBe(original);
					const result = applyProjectionDocumentPatch(parsed.document, {
						type: "remove-node",
						documentId: "workout",
						baseRevision: String(revision + 1),
						revision: String(revision + 2),
						nodeId: "summary",
					});
					expect(result.ok).toBe(false);
					expect(parsed.document).toEqual(original);
				},
			),
			parameters,
		);
	});

	it("rejects accessor-backed and executable document data without invoking getters", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("href", "src", "action", "formaction", "xlink:href"),
				fc.constantFrom("javascript:", "vbscript:", "data:text/html,"),
				(key, scheme) => {
					const getter = vi.fn(() => "unsafe");
					const input = {
						id: "workout",
						revision: "1",
						nodes: [
							{
								kind: "form",
								id: "form",
								fields: [
									{
										id: "field",
										label: "Field",
										input: { type: "object" },
										value: { [key]: scheme },
									},
								],
							},
						],
					};
					const parsed = parseProjectionDocument(input);
					if (parsed.ok)
						expect(
							validateProjectionDocument(parsed.document, context).length,
						).toBeGreaterThan(0);
					Object.defineProperty(input, "title", {
						enumerable: true,
						get: getter,
					});
					expect(parseProjectionDocument(input).ok).toBe(false);
					expect(getter).not.toHaveBeenCalled();
				},
			),
			parameters,
		);
	});
});
