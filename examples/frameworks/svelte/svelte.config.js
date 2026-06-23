import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// The only Svelte config: enable `vitePreprocess` so `<script lang="ts">` is
// transpiled. No custom-element compiler option is needed — Svelte consumes
// hyphenated custom-element tags through the standard browser surface.
export default {
	preprocess: vitePreprocess(),
};
