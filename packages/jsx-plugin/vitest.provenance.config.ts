import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import base from "./vitest.config";

// Match Stryker's copied source to the actual resolved workspace dependency.
export default defineConfig({
	...base,
	root: fileURLToPath(new URL(".", import.meta.url)),
	test: { ...base.test, include: ["src/workspace-provenance.test.ts"] },
});
