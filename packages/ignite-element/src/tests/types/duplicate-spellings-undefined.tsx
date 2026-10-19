/** @jsxImportSource ../../renderers/jsx */
// biome-ignore-all lint/a11y: type fixture for duplicate JSX spellings
import { jsx } from "../../renderers/jsx/jsx-runtime";

const click = () => undefined;
const maybe = undefined as string | undefined;

// An alias passed as `undefined` is still a second spelling.
// Known limit: without exactOptionalPropertyTypes TypeScript cannot tell an
// absent optional prop from a literal `undefined`, so JSX tag syntax accepts
// `for={undefined}`. Any value that can be a string is rejected below, and
// jsx() calls reject the key whatever its value. Development builds warn.
const tagLiteral = <label htmlFor="a" for={undefined} />;
// @ts-expect-error htmlFor and for are one prop even when for may be undefined
const tagMaybe = <label htmlFor="a" for={maybe} />;
// @ts-expect-error className and class are one prop even when class may be undefined
const tagClass = <div className="on" class={maybe} />;
// @ts-expect-error htmlFor and for are one prop in jsx() even when for is undefined
const callLiteral = jsx("label", { htmlFor: "a", for: undefined });
// @ts-expect-error onClick and onclick are one prop in jsx() even when undefined
const callEvent = jsx("button", { onClick: click, onclick: undefined });

export const undefinedAliases = {
	tagLiteral,
	tagMaybe,
	tagClass,
	callLiteral,
	callEvent,
};
