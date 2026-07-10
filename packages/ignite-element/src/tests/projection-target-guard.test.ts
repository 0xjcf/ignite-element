// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	createProjectionDocumentTarget,
	createProjectionSpeechTarget,
	isProjectionTarget,
} from "../runtime/projectionTargets";

describe("projection target guard", () => {
	it("accepts only first-party targets with the expected internal shape", () => {
		expect(
			isProjectionTarget(
				createProjectionDocumentTarget({
					commitDocument: () => undefined,
				}),
			),
		).toBe(true);

		expect(
			isProjectionTarget(
				createProjectionSpeechTarget({
					commitSpeech: () => undefined,
					acknowledgeCommandName: "acknowledgeSpeech",
				}),
			),
		).toBe(true);

		expect(
			isProjectionTarget({
				kind: "document",
				commitDocument: () => undefined,
			}),
		).toBe(false);

		expect(
			isProjectionTarget({
				kind: "speech",
				commitSpeech: () => undefined,
				acknowledgeCommandName: "acknowledgeSpeech",
			}),
		).toBe(false);
	});
});
