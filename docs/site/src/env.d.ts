// Starlight 0.42 publishes compiled JavaScript and no longer ships the
// ambient `virtual:starlight/*` module declarations that component overrides
// import. Declare the config module this site uses.
declare module "virtual:starlight/user-config" {
	import type { StarlightConfig } from "@astrojs/starlight/types";

	const config: StarlightConfig;
	export default config;
}
