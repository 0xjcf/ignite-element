import type { RspackPluginInstance } from "@rspack/core";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => RspackPluginInstance =
	igniteJsx.rspack;
export default plugin;
