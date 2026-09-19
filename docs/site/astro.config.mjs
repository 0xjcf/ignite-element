// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import scrollableTables from "./src/rehype-scrollable-tables.mjs";

import starlightVersions from "starlight-versions";

// https://astro.build/config
export default defineConfig({
	site: "https://0xjcf.github.io",
	base: "/ignite-element",
	// Live demos import the canonical example modules outside this site package.
	// Resolve their public dependencies from the site and share one React runtime.
	vite: {
		resolve: { dedupe: ["react", "react-dom", "ignite-element", "xstate"] },
	},
	// Astro's built-in GFM isn't reaching the Starlight MDX pipeline in this
	// Astro 6 / Starlight 0.39 setup, so GFM tables render as literal pipes.
	// Apply remark-gfm explicitly so `| … |` tables (and other GFM) render.
	markdown: {
		remarkPlugins: [remarkGfm],
		rehypePlugins: [scrollableTables],
	},
	integrations: [
		starlight({
			title: "Ignite Element",
			plugins: [
				starlightVersions({
					versions: [{ slug: "2.x", label: "2.x" }],
					current: { label: "v3 (beta)" },
				}),
			],
			description:
				"Platform-native custom elements with typed state, effects, events, and a headless runtime.",
			// Beta-era branding: the green logo/favicon mark v3 beta pages; the
			// 2.x archive keeps the stable cyan variants via the SiteTitle
			// override and route middleware below. Revert both at stable v3.
			logo: {
				dark: "./src/assets/ignite-element-logo.svg",
				light: "./src/assets/ignite-element-logo-light.svg",
				alt: "Ignite Element logo",
			},
			favicon: "/ignite-element-favicon.svg",
			components: {
				Header: "./src/components/Header.astro",
				SiteTitle: "./src/components/SiteTitle.astro",
				ThemeSelect: "./src/components/ThemeSelect.astro",
				PageTitle: "./src/components/PageTitle.astro",
				Banner: "./src/components/Banner.astro",
				Footer: "./src/components/Footer.astro",
			},
			routeMiddleware: "./src/starlightRouteData.ts",
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/0xjcf/ignite-element",
				},
			],
			customCss: ["./src/styles/theme.css"],
			sidebar: [
				{
					label: "Getting started",
					slug: "index",
				},
				{
					label: "Sources",
					slug: "handbook/sources",
				},
				{
					label: "Views",
					slug: "handbook/views",
				},
				{
					label: "Events & effects",
					slug: "handbook/events",
				},
				{
					label: "Ownership & cleanup",
					slug: "handbook/ownership",
				},
				{
					label: "Testing",
					slug: "handbook/testing",
				},
				{
					label: "API reference",
					slug: "handbook/api",
				},
				{
					label: "Examples",
					slug: "handbook/examples",
				},
				{
					label: "Guides",
					collapsed: true,
					items: [
						{ label: "Shared sources", slug: "guides/shared-source-ownership" },
						{ label: "Routing", slug: "guides/routing" },
						{ label: "Accessibility", slug: "guides/accessibility-first" },
						{ label: "Build for agents", slug: "guides/agent-runtime-v3" },
					],
				},
			],
		}),
	],
});
