import type { Plugin } from "esbuild";
import type { IgniteJsxOptions } from "./options.js";
import igniteJsx from "./unplugin.js";

const plugin: (options?: IgniteJsxOptions) => Plugin = igniteJsx.esbuild;
export default plugin;
