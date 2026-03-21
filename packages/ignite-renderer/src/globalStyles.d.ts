export interface StyleObject {
    href: string;
    integrity?: string;
    crossOrigin?: string;
}
export type GlobalStyles = string | StyleObject | undefined;
export declare function setGlobalStyles(style: GlobalStyles): void;
export declare function getGlobalStyles(): GlobalStyles;
//# sourceMappingURL=globalStyles.d.ts.map