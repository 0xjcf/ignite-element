import { createApp } from "vue";
// Importing the module registers <ignite-toggle> as a custom element (side
// effect). Do it once, before the app mounts, so the tag is defined when Vue
// renders it.
import "./toggle.ignite";
import App from "./App.vue";

createApp(App).mount("#app");
