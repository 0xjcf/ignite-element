// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
	isProjectionTarget,
} from "../runtime/projectionTargets";
import { igniteProjectionTargetBrand } from "../types/projectionTargetBrand";

describe("projection target guard", () => {
	it("creates frozen opaque shells without target configuration properties", () => {
		const documentTarget = createProjectionDocumentTarget({
			documentId: "panel",
			commitDocument: () => undefined,
		});
		const speechTarget = createProjectionSpeechTarget({
			commitSpeech: () => undefined,
			acknowledgeCommandName: "acknowledgeSpeech",
			resolveAcknowledgePayload: (speech) => ({ speechId: speech.id }),
		});

		expect(Object.isFrozen(documentTarget)).toBe(true);
		expect(Object.isFrozen(speechTarget)).toBe(true);
		expect(Object.keys(documentTarget)).toEqual([]);
		expect(Object.keys(speechTarget)).toEqual([]);
		expect(new Set(Reflect.ownKeys(documentTarget))).toEqual(
			new Set(["kind", "documentId", igniteProjectionTargetBrand]),
		);
		expect(new Set(Reflect.ownKeys(speechTarget))).toEqual(
			new Set(["kind", igniteProjectionTargetBrand]),
		);
		expect(Reflect.get(documentTarget, "commitDocument")).toBeUndefined();
		expect(Reflect.get(speechTarget, "commitSpeech")).toBeUndefined();
		expect("commitDocument" in documentTarget).toBe(false);
		expect("commitSpeech" in speechTarget).toBe(false);
		expect(Reflect.get(speechTarget, "acknowledgeCommandName")).toBeUndefined();
		expect(
			Reflect.get(speechTarget, "resolveAcknowledgePayload"),
		).toBeUndefined();
		expect(
			Object.getOwnPropertyDescriptor(documentTarget, "kind"),
		).toMatchObject({
			enumerable: false,
			writable: false,
		});
		expect(
			Object.getOwnPropertyDescriptor(documentTarget, "documentId"),
		).toMatchObject({
			enumerable: false,
			writable: false,
		});
	});

	it("accepts only targets registered by the first-party constructors", () => {
		const documentTarget = createProjectionDocumentTarget({
			commitDocument: () => undefined,
		});
		const speechTarget = createProjectionSpeechTarget({
			commitSpeech: () => undefined,
			acknowledgeCommandName: "acknowledgeSpeech",
		});
		const documentClone = {};
		Object.defineProperties(
			documentClone,
			Object.getOwnPropertyDescriptors(documentTarget),
		);
		const speechClone = {};
		Object.defineProperties(
			speechClone,
			Object.getOwnPropertyDescriptors(speechTarget),
		);

		expect(isProjectionTarget(documentTarget)).toBe(true);
		expect(isProjectionTarget(speechTarget)).toBe(true);
		expect(isProjectionTarget(documentClone)).toBe(false);
		expect(isProjectionTarget(speechClone)).toBe(false);

		expect(
			isProjectionTarget({
				[igniteProjectionTargetBrand]: true,
				kind: "document",
				commitDocument: () => undefined,
			}),
		).toBe(false);

		expect(
			isProjectionTarget({
				[igniteProjectionTargetBrand]: true,
				kind: "speech",
				commitSpeech: () => undefined,
				acknowledgeCommandName: "acknowledgeSpeech",
			}),
		).toBe(false);
	});

	it("rejects invalid target options before registering a shell", () => {
		expect(() =>
			Reflect.apply(createProjectionDocumentTarget, undefined, [
				{ commitDocument: "not-a-function" },
			]),
		).toThrow("commitDocument must be a function");
		expect(() =>
			Reflect.apply(createProjectionDocumentTarget, undefined, [
				{ commitDocument: () => undefined, documentId: 1 },
			]),
		).toThrow("documentId must be a string");
		expect(() =>
			Reflect.apply(createProjectionSpeechTarget, undefined, [
				{ commitSpeech: () => undefined, acknowledgeCommandName: 1 },
			]),
		).toThrow("acknowledgeCommandName must be a string");
		expect(() =>
			Reflect.apply(createProjectionSpeechTarget, undefined, [
				{ acknowledgeCommandName: "acknowledgeSpeech" },
			]),
		).toThrow("commitSpeech must be a function");
		expect(() =>
			Reflect.apply(createProjectionSpeechTarget, undefined, [
				{
					commitSpeech: () => undefined,
					acknowledgeCommandName: "acknowledgeSpeech",
					resolveAcknowledgePayload: "not-a-function",
				},
			]),
		).toThrow("resolveAcknowledgePayload must be a function");
	});
});
