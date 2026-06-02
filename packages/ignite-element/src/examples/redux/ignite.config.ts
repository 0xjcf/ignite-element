import { defineIgniteConfig } from "@ignite-element/renderer";

const stylesUrl = new URL("./src/dist/styles.css", import.meta.url).href;

export default defineIgniteConfig({
	styles: stylesUrl,
});
