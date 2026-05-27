import { defineIgniteConfig } from "ignite-renderer";

const stylesUrl = new URL("./src/dist/styles.css", import.meta.url).href;

export default defineIgniteConfig({
	styles: stylesUrl,
});
