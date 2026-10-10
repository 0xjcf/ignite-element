import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { findPublishedHostDeclarations } from "../published-host-declarations.mjs";

const repositoryRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

test("published declarations do not name the internal host runtime", () => {
	const hits = findPublishedHostDeclarations(repositoryRoot);
	assert.deepEqual(
		hits,
		[],
		hits.map((hit) => `${hit.file} names ${hit.name}`).join("\n"),
	);
});
