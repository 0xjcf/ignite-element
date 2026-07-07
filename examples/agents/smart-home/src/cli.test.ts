// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { AgentResult } from "./agentLoop";
import { AgentResultCloseError, printAndCloseAgentResult } from "./cli";

function createAgentResult(close: () => Promise<void>): AgentResult {
	return {
		home: {} as AgentResult["home"],
		close,
		trace: [],
		finalText: "",
		modelCalls: 0,
	};
}

describe("smart-home CLI helpers", () => {
	it("preserves print and close failures together", async () => {
		const printError = new Error("print failed");
		const closeError = new Error("close failed");
		const result = createAgentResult(async () => {
			throw closeError;
		});

		try {
			await printAndCloseAgentResult(result, () => {
				throw printError;
			});
			throw new Error("Expected printAndCloseAgentResult to reject.");
		} catch (error) {
			expect(error).toBeInstanceOf(AgentResultCloseError);
			expect((error as AgentResultCloseError).errors).toEqual([
				printError,
				closeError,
			]);
		}
	});
});
