// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";
import starlightVersions from "starlight-versions";

// https://astro.build/config
export default defineConfig({
	site: "https://0xjcf.github.io",
	base: "/ignite-element",
	integrations: [
		starlight({
			title: "Ignite Element",
			plugins: [
				// Keep the frozen v2 archive out of the agent-facing llms output.
				// Note: `exclude` only filters llms-small.txt; /llms-full.txt is
				// injected by the plugin and always contains every page.
				starlightLlmsTxt({ exclude: ["2.x/**"] }),
				starlightVersions({
					versions: [{ slug: "2.x", label: "2.x" }],
					current: { label: "v3 (beta)" },
				}),
			],
			description:
				"Platform-native custom elements with typed state, effects, events, and a headless runtime.",
			logo: {
				dark: "./src/assets/ignite-element-logo.svg",
				light: "./src/assets/ignite-element-logo-light.svg",
				alt: "Ignite Element logo",
			},
			favicon: "/ignite-element-favicon.svg",
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
					label: "Overview",
					items: [
						{ label: "Welcome", slug: "index" },
						{
							label: "What is Ignite Element?",
							slug: "overview/what-is-ignite-element",
						},
					],
				},
				{
					label: "Getting Started",
					items: [
						{ label: "Installation", slug: "getting-started/installation" },
						{
							label: "Your first component",
							slug: "getting-started/first-component",
						},
					],
				},
				{
					label: "Concepts",
					items: [
						{ label: "The Ignite model", slug: "concepts/the-ignite-model" },
					],
				},
				{
					label: "API",
					items: [
						{ label: "igniteCore", slug: "api/ignite-core" },
						{ label: "Headless runtime", slug: "api/headless-runtime" },
						{ label: "Command metadata", slug: "api/command-metadata" },
						{ label: "Testing DSL", slug: "api/testing-dsl" },
						{ label: "Advanced config", slug: "api/advanced-config" },
						{ label: "Compatibility", slug: "api/compatibility" },
					],
				},
				{
					label: "Guides",
					items: [
						{
							label: "Host app integration",
							slug: "guides/host-app-integration",
						},
						{
							label: "Build for agents",
							slug: "guides/agent-runtime-v3",
						},
						{ label: "Redux & MobX", slug: "guides/redux-and-mobx" },
						{ label: "Actor-Web", slug: "guides/actor-web" },
						{ label: "Styling", slug: "guides/styling" },
						{ label: "Testing", slug: "guides/testing" },
					],
				},
				{
					label: "Migration",
					items: [
						{ label: "v2 → v3 (beta)", slug: "migration/v3" },
						{
							label: "Command emit → effects",
							slug: "migration/effects-events",
						},
						{ label: "v1 → v2", slug: "migration/v2" },
					],
				},
				{
					label: "Community",
					items: [{ label: "Support & links", slug: "community" }],
				},
			],
		}),
	],
});
