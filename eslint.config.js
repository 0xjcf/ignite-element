import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import security from "eslint-plugin-security";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "dist",
      "src/tests",
      "vitest.config.ts",
      "vite.config.ts",
      "vitest.node.config.ts",
      "src/examples",
      "coverage",
      "vitest.setup.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: globals.browser,
    },
    plugins: {
      "@typescript-eslint": tseslint,
      security,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...security.configs.recommended.rules,
    },
  },
];
