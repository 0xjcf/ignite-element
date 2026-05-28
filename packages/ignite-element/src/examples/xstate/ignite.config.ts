import { defineIgniteConfig } from "ignite-renderer";

// Advanced compatibility only: the default v3 example path stays config-free
// and uses ordinary local <style> tags plus any host-loaded global CSS.
export default defineIgniteConfig({
	// Resolve to an absolute URL so Vite dev/preview and static builds
	// all load the stylesheet correctly.
	styles: new URL("./dist/styles.css", import.meta.url).href,
});
