// @ts-check

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://0xjcf.github.io",
	base: "/ignite-element",
	integrations: [
		starlight({
			title: "Ignite Element v2",
			description:
				"Framework-agnostic custom elements with typed state, powered by your favorite state library.",
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
						{ label: "Project setup", slug: "getting-started/project-setup" },
					],
				},
				{
					label: "Concepts",
					items: [
						{ label: "State adapters", slug: "concepts/state-adapters" },
						{ label: "Renderers", slug: "concepts/renderers" },
						{
							label: "Events & commands",
							slug: "concepts/events-and-commands",
						},
						{ label: "Configuration", slug: "concepts/configuration" },
					],
				},
				{
					label: "API",
					items: [
						{ label: "igniteCore", slug: "api/ignite-core" },
						{ label: "defineIgniteConfig", slug: "api/define-ignite-config" },
						{ label: "Renderers & strategies", slug: "api/renderers" },
					],
				},
				{
					label: "Guides",
					items: [
						{ label: "Styling", slug: "guides/styling" },
						{ label: "Testing", slug: "guides/testing" },
						{ label: "Tooling & bundlers", slug: "guides/tooling" },
					],
				},
				{
					label: "Migration",
					items: [{ label: "v1 → v2", slug: "migration/v2" }],
				},
				{
					label: "Community",
					items: [{ label: "Support & links", slug: "community" }],
				},
			],
		}),
	],
});
