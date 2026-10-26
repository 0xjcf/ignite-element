import type { Plugin } from "rolldown";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => Plugin | Plugin[] =
	igniteJsx.rolldown;
export default plugin;
