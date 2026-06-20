// Importing the module registers <ignite-stepper> as a custom element (side
// effect). Do it once, before the app mounts, so the tag is defined when Svelte
// renders it.
import "./stepper.ignite";
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) {
	throw new Error("Missing #app container");
}

mount(App, { target });
