import { execFileSync } from "node:child_process";
import {
	cpSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const output = mkdtempSync(join(tmpdir(), "ignite-handbook-consumers-"));
const run = (cwd, command, args) =>
	execFileSync(command, args, { cwd, stdio: "inherit" });
const json = (file, value) =>
	writeFileSync(file, JSON.stringify(value, null, 2));
mkdirSync(join(output, "tarballs"));
const dependencies = {};
for (const dir of [
	"ignite-core",
	"ignite-adapters",
	"ignite-renderer",
	"ignite-element",
]) {
	const folder = join(repo, "packages", dir);
	const pkg = JSON.parse(readFileSync(join(folder, "package.json"), "utf8"));
	run(folder, "pnpm", [
		"pack",
		"--config.ignore-scripts=true",
		"--pack-destination",
		join(output, "tarballs"),
	]);
	dependencies[pkg.name] =
		`file:../tarballs/${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`;
}
for (const lane of ["web", "native"]) {
	const dir = join(output, lane);
	mkdirSync(dir);
	let manifest;
	if (lane === "native") {
		cpSync(
			join(repo, "scripts/__tests__/fixtures/react-native-bindings"),
			dir,
			{ recursive: true },
		);
		manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
		copyFileSync(
			join(repo, "scripts/__tests__/fixtures/handbook/CounterScreen.tsx"),
			join(dir, "CounterScreen.tsx"),
		);
		const config = JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8"));
		config.include.push("CounterScreen.tsx", "counter-core.ts");
		json(join(dir, "tsconfig.json"), config);
	} else {
		manifest = {
			private: true,
			type: "module",
			devDependencies: {
				typescript: "5.9.3",
				react: "19.1.0",
				"react-dom": "19.1.0",
				"@types/react": "19.1.0",
				"@types/react-dom": "19.1.0",
				"@types/node": "25.0.3",
				"@reduxjs/toolkit": "2.12.0",
				redux: "5.0.1",
				mobx: "6.16.1",
				vitest: "3.2.4",
				jsdom: "26.1.0",
				"@testing-library/dom": "10.4.1",
				"@testing-library/react": "16.3.0",
			},
		};
		for (const name of ["light-switch.tsx", "light-switch.css"])
			copyFileSync(
				join(repo, "docs/site/src/examples/light-switch/src", name),
				join(dir, name),
			);
		for (const name of [
			"toggle.test.tsx",
			"redux.ts",
			"mobx.ts",
			"source.test.ts",
			"core.test.ts",
		])
			copyFileSync(
				join(repo, "scripts/__tests__/fixtures/handbook", name),
				join(dir, name),
			);
		copyFileSync(
			join(repo, "examples/frameworks/react/shared-counter.tsx"),
			join(dir, "shared-counter.tsx"),
		);
		copyFileSync(
			join(repo, "examples/adapters/xstate/event-counter.ts"),
			join(dir, "event-counter.ts"),
		);
		const migration = readFileSync(
			join(repo, "docs/site/src/content/docs/migration/effects-events.mdx"),
			"utf8",
		).match(/```ts title="toggle-events.ts"\n([\s\S]*?)```/);
		if (!migration) throw new Error("Current migration module is missing");
		writeFileSync(join(dir, "toggle-events.ts"), migration[1]);
		// Compile the actual linked README with its real decorated MobX store.
		const mobxReadme = readFileSync(
			join(repo, "examples/adapters/mobx/README.md"),
			"utf8",
		).match(/```ts title="mobx-cores.ts"\n([\s\S]*?)```/);
		if (!mobxReadme) throw new Error("MobX README module is missing");
		const mobxDir = join(dir, "mobx-readme");
		mkdirSync(mobxDir);
		writeFileSync(join(mobxDir, "mobx-cores.ts"), mobxReadme[1]);
		copyFileSync(
			join(repo, "examples/adapters/mobx/mobxCounterStore.ts"),
			join(mobxDir, "mobxCounterStore.ts"),
		);
		json(join(mobxDir, "tsconfig.json"), {
			extends: "../tsconfig.json",
			compilerOptions: { experimentalDecorators: true },
			include: ["*.ts"],
		});
		json(join(dir, "tsconfig.json"), {
			compilerOptions: {
				strict: true,
				skipLibCheck: false,
				noEmit: true,
				target: "ES2022",
				module: "ESNext",
				moduleResolution: "Bundler",
				jsx: "react-jsx",
				lib: ["ES2022", "ESNext.Collection", "DOM", "DOM.Iterable"],
				types: ["node"],
			},
			include: ["*.ts", "*.tsx"],
		});
		writeFileSync(
			join(dir, "vitest.config.ts"),
			'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { environment: "jsdom" } });\n',
		);
		copyFileSync(
			join(repo, "scripts/__tests__/fixtures/handbook/react.test.tsx"),
			join(dir, "react.test.tsx"),
		);
	}
	copyFileSync(
		join(repo, "examples/frameworks/react/counter-core.ts"),
		join(dir, "counter-core.ts"),
	);
	manifest.dependencies = { ...dependencies, xstate: "5.32.1" };
	manifest.pnpm = { overrides: dependencies };
	json(join(dir, "package.json"), manifest);
	writeFileSync(
		join(dir, ".npmrc"),
		`auto-install-peers=false\n${lane === "native" ? "node-linker=hoisted\n" : ""}`,
	);
	run(dir, "pnpm", ["install"]);
	run(dir, "pnpm", ["exec", "tsc", "-p", "tsconfig.json"]);
	if (lane === "native") {
		run(dir, "pnpm", ["run", "isolation"]);
		run(dir, "pnpm", ["test"]);
	} else {
		run(dir, "pnpm", ["exec", "tsc", "-p", "mobx-readme/tsconfig.json"]);
		run(dir, "pnpm", ["exec", "vitest", "run"]);
	}
}
console.log(
	`Strict packed handbook consumers passed. Task-local evidence retained: ${output}`,
);
