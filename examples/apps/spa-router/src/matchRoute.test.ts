import { describe, expect, it } from "vitest";
import { matchRoute } from "./matchRoute";

// The matcher is a pure function, so it is tested with plain inputs — no DOM,
// no History, no jsdom. This is the same property that lets the whole router be
// driven headlessly.
describe("matchRoute", () => {
	it("matches the root path", () => {
		expect(matchRoute("/")).toEqual({ name: "home", params: {}, path: "/" });
	});

	it("matches a static route", () => {
		expect(matchRoute("/about")).toEqual({
			name: "about",
			params: {},
			path: "/about",
		});
	});

	it("captures a dynamic param", () => {
		expect(matchRoute("/users/42")).toEqual({
			name: "user",
			params: { id: "42" },
			path: "/users/42",
		});
	});

	it("prefers the static /users route over the dynamic /users/:id", () => {
		expect(matchRoute("/users").name).toBe("users");
	});

	it("decodes percent-encoded params", () => {
		expect(matchRoute("/users/ada%20lovelace").params.id).toBe("ada lovelace");
	});

	it("ignores a trailing slash (except root)", () => {
		expect(matchRoute("/about/").name).toBe("about");
		expect(matchRoute("/about/").path).toBe("/about");
	});

	it("strips query and hash before matching", () => {
		expect(matchRoute("/users/7?tab=posts#top")).toEqual({
			name: "user",
			params: { id: "7" },
			path: "/users/7",
		});
	});

	it("returns not-found for an unknown path", () => {
		expect(matchRoute("/nope/nowhere")).toEqual({
			name: "not-found",
			params: {},
			path: "/nope/nowhere",
		});
	});
});
