import { defineIgniteConfig } from "../../config";

const stylesUrl = new URL("./src/scss/styles.scss", import.meta.url).href;

export default defineIgniteConfig({
	globalStyles: stylesUrl,
});
