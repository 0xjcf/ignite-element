import type { WebpackPluginInstance } from "webpack";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => WebpackPluginInstance =
	igniteJsx.webpack;
export default plugin;
