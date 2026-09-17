import assert from "node:assert/strict";
import test from "node:test";
import routes from "../src/route-map.json" with { type: "json" };
import {
	currentRoute,
	routeUrl,
	versionDestination,
} from "../src/route-map.mjs";

test("version selection falls back to the selected home when the archive has no counterpart", () => {
	assert.equal(
		routeUrl(
			versionDestination("contributing/shared-controller-validation", true),
		),
		"/ignite-element/2.x/",
	);
});
test("archive banners and return switches reach the consolidated source handbook", () => {
	assert.equal(
		routeUrl(versionDestination("2.x/concepts/state-adapters", false)),
		"/ignite-element/handbook/sources/",
	);
	assert.equal(
		versionDestination("handbook/sources", true),
		"2.x/concepts/state-adapters",
	);
});
test("old first-component routes lead to the working onboarding page", () => {
	assert.equal(currentRoute("getting-started/first-component"), "");
	assert.equal(
		versionDestination("2.x/getting-started/first-component", false),
		"",
	);
});
test("advanced current pages retain a useful current destination", () => {
	assert.equal(
		versionDestination("api/advanced-config", false),
		"api/advanced-config",
	);
	assert.equal(
		versionDestination("api/advanced-config", true),
		"2.x/concepts/configuration",
	);
});

test("legacy Events sections preserve their corresponding handbook subjects", () => {
	for (const heading of [
		"one-counter-two-meanings",
		"delivery-and-ownership",
		"migration-from-per-view-effects",
		"one-production-rule-per-public-event",
	]) {
		assert.equal(
			routes.fragmentTargets["guides/events"][heading],
			`/ignite-element/handbook/events/#${heading}`,
		);
	}
});

test("retired beta notes lead to current contracts, preserving useful section links", () => {
	assert.equal(currentRoute("migration/command-source"), "handbook/sources");
	assert.equal(
		currentRoute("migration/shared-readiness-terminal-disposal"),
		"handbook/ownership",
	);
	assert.equal(currentRoute("api/testing-dsl"), "handbook/testing");
	assert.equal(
		routes.fragmentTargets["migration/command-source"][
			"rename-the-callback-property"
		],
		"/ignite-element/handbook/sources/#command-target",
	);
	assert.equal(
		routes.fragmentTargets["migration/command-source"][
			"keep-the-same-source-ownership"
		],
		"/ignite-element/handbook/ownership/#shared-or-isolated",
	);
});
