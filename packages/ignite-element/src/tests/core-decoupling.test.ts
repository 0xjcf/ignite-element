import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architecture guard for the actor-web decoupling (Seam A).
 *
 * Invariant: ignite-element CORE is a standalone state-binding library. The
 * external actor-web runtime (`@actor-core/*` / `@actor-web/*`) is an OPTIONAL
 * integration that may only be referenced from the `@ignite-element/adapters`
 * seam — never from `@ignite-element/core` or the `ignite-element` element
 * package. The dependency edge is `ignite-adapters -> actor-web`, never
 * `ignite-core -> actor-web` or `ignite-element -> actor-web`.
 *
 * See .fas/state/spikes/send-command-helper.md and the actor-web decoupling
 * design (../actor-web/docs/actor-web-decoupling-design.md, Seam A).
 */

// cwd during vitest is packages/ignite-element; repo root is two levels up.
const repoRoot = resolve(process.cwd(), "..", "..");

// Matches `import ... from "@actor-core/..."`, side-effect imports, re-exports,
// and dynamic import() of the EXTERNAL actor-web packages. Ignite's own
// `@ignite-element/adapters/actor-web` entrypoint is NOT matched (different scope).
const EXTERNAL_ACTOR_WEB =
	/(?:from|import|require)\s*\(?\s*["']@actor-(?:core|web)\//;

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "tests"]);

function collectSourceFiles(dir: string): string[] {
	const out: string[] = [];
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (SKIP_DIRS.has(entry) || entry === "__tests__") {
				continue;
			}
			out.push(...collectSourceFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

function filesImportingExternalActorWeb(srcDir: string): string[] {
	return collectSourceFiles(srcDir).filter((file) =>
		EXTERNAL_ACTOR_WEB.test(readFileSync(file, "utf8")),
	);
}

function actorWebDependencyKeys(packageJsonPath: string): string[] {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<
		string,
		Record<string, string> | undefined
	>;
	const fields = [
		"dependencies",
		"peerDependencies",
		"optionalDependencies",
	] as const;
	return fields.flatMap((field) =>
		Object.keys(pkg[field] ?? {}).filter((name) =>
			/^@actor-(core|web)\//.test(name),
		),
	);
}

describe("actor-web decoupling — core stays standalone (Seam A guard)", () => {
	it("@ignite-element/core declares no external actor-web dependency", () => {
		expect(
			actorWebDependencyKeys(
				join(repoRoot, "packages/ignite-core/package.json"),
			),
		).toEqual([]);
	});

	it("@ignite-element/core source never imports the external actor-web runtime", () => {
		expect(
			filesImportingExternalActorWeb(
				join(repoRoot, "packages/ignite-core/src"),
			),
		).toEqual([]);
	});

	it("the ignite-element element package declares no external actor-web dependency", () => {
		expect(
			actorWebDependencyKeys(
				join(repoRoot, "packages/ignite-element/package.json"),
			),
		).toEqual([]);
	});

	it("the ignite-element element package never imports the external actor-web runtime", () => {
		// The `ignite-element/actor-web` entrypoint binds via the in-repo
		// `@ignite-element/adapters` seam (duck-typed source objects), so the
		// element package is usable without the external actor-web library.
		expect(
			filesImportingExternalActorWeb(
				join(repoRoot, "packages/ignite-element/src"),
			),
		).toEqual([]);
	});
});
