export interface StyleObject {
  href: string;
  integrity?: string;
  crossOrigin?: string;
}

export type GlobalStyles = string | StyleObject | undefined;

let globalStyles: GlobalStyles;

export function setGlobalStyles(style: GlobalStyles): void {
  if (Array.isArray(style)) {
    throw new Error(
      "setGlobalStyles does not accepts arrays. Provide a single string or StyleObject."
    );
  }
  globalStyles = style;
}

export function getGlobalStyles(): GlobalStyles {
  return globalStyles;
}
