import { execSync } from "node:child_process";
import chalk from "chalk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import refreshNpmToken from "../refresh-npm-token";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));
global.fetch = vi.fn();

describe("refreshNpmToken", () => {
	const mockGithubToken = "mock-github-token";
	const mockRepoName = "mock-user/mock-repo";
	const mockNewToken = "mock-new-token";

	let consoleErrorSpy;

	beforeEach(() => {
		process.env.GITHUB_TOKEN = mockGithubToken;
		process.env.REPO_NAME = mockRepoName;

		vi.mocked(execSync).mockReturnValue(mockNewToken);
		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
		});

		// Spy on console.error to suppress logs
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.resetAllMocks();
		delete process.env.GITHUB_TOKEN;
		delete process.env.REPO_NAME;
		consoleErrorSpy.mockRestore();
	});

	it("should generate a new NPM token and update GitHub secrets", async () => {
		console.log(chalk.cyan.bold("Testing token generation..."));
		await refreshNpmToken();
	});

	it("should throw an error if GITHUB_TOKEN or REPO_NAME is missing", async () => {
		console.log(chalk.cyan.bold("Testing missing environment variables..."));

		// Remove environment variables
		delete process.env.GITHUB_TOKEN;

		// Assert that refreshNpmToken rejects with the correct error
		await expect(refreshNpmToken()).rejects.toThrow(
			"Missing GITHUB_TOKEN or REPO_NAME environment variables.",
		);
	});

	it("should handle API failure gracefully", async () => {
		console.log(chalk.cyan.bold("Testing API failure..."));

		// Mock fetch to simulate API failure
		vi.mocked(global.fetch).mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		});

		// Assert that refreshNpmToken rejects with the correct error
		await expect(refreshNpmToken()).rejects.toThrow(
			"Failed to update secret: Internal Server Error",
		);
	});
});
