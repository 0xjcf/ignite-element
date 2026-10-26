import type { Plugin } from "vite";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => Plugin | Plugin[] =
	igniteJsx.vite;
export default plugin;
