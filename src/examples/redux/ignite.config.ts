import { defineIgniteConfig } from "../../config";

const stylesUrl = new URL("./src/dist/styles.css", import.meta.url).href;

export default defineIgniteConfig({
	globalStyles: stylesUrl,
});
