import { describe, afterEach, it, expect } from "vitest";
import { setGlobalStyles, getGlobalStyles } from "../globalStyles";

describe("globalStyles", () => {
  afterEach(() => {
    setGlobalStyles("");
  });

  it("should set and retrieve a single string style", () => {
    const style = "./theme.css";
    setGlobalStyles(style);

    const styles = getGlobalStyles();
    expect(styles).toBe(style);
  });

  it("should set and retrieve a single StyleObject", () => {
    const style = {
      href: "./theme.css",
      integrity: "sha384-abc123",
      crossorigin: "anonymous",
    };
    setGlobalStyles(style);

    const styles = getGlobalStyles();
    expect(styles).toEqual(style);
  });

  it("should throw an error if an array is passed", () => {
    expect(() =>
      // @ts-expect-error - testing invalid input
      setGlobalStyles(["./theme.css", "./other.css"])
    ).toThrow(
      "setGlobalStyles does not accepts arrays. Provide a single string or StyleObject."
    );
  });

  it("should override existing global styles when called again", () => {
    setGlobalStyles("./theme.css");
    expect(getGlobalStyles()).toEqual("./theme.css");

    setGlobalStyles("./new-theme.css");
    expect(getGlobalStyles()).toEqual("./new-theme.css");
  });

  it("should override existing global StyleObject when called again", () => {
    const style1 = {
      href: "./theme.css",
      integrity: "sha384-abc123",
      crossorigin: "anonymous",
    };

    const style2 = {
      href: "./new-theme.css",
    };

    setGlobalStyles(style1);
    expect(getGlobalStyles()).toEqual(style1);

    setGlobalStyles(style2);
    expect(getGlobalStyles()).toEqual(style2);
  });
});
