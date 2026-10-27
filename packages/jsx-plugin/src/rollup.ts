import type { Plugin } from "rollup";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => Plugin | Plugin[] =
	igniteJsx.rollup;
export default plugin;
