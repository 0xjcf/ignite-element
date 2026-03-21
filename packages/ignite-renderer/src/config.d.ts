import { type GlobalStyles } from "./globalStyles";
export type IgniteRendererId = "lit" | "ignite-jsx";
export type IgniteRenderStrategyId = "diff" | "replace" | (string & {});
export type IgniteLoggingLevel = "off" | "warn" | "debug" | (string & {});
/**
 * Public configuration shape. Additional options can be added in future phases.
 * `globalStyles` remains as a deprecated alias for `styles` during migration.
 */
export interface IgniteConfig {
    styles?: GlobalStyles;
    renderer?: IgniteRendererId;
    strategy?: IgniteRenderStrategyId;
    logging?: IgniteLoggingLevel;
    /** @deprecated Use `styles` instead. */
    globalStyles?: GlobalStyles;
}
export declare function defineIgniteConfig(config: IgniteConfig): IgniteConfig;
export declare function getIgniteConfig(): IgniteConfig | undefined;
//# sourceMappingURL=config.d.ts.map