/** @jsxImportSource ../../renderers/jsx */
// biome-ignore-all lint/a11y: type fixture for duplicate JSX spellings

const click = () => undefined;

const labelFor = <label htmlFor="a" />;
const labelAttr = <label for="b" />;
const buttonClick = <button onClick={click} />;
const buttonAttr = <button onclick={click} />;
const formCharset = <form acceptCharset="utf-8" />;
const formAttr = <form accept-charset="utf-8" />;
const named = <div ariaLabel="name" />;
const namedAttr = <div aria-label="name" />;
const className = <div className="on" />;
const classAttr = <div class="off" />;

// @ts-expect-error htmlFor and for are one prop
const label = <label htmlFor="a" for="b" />;
// @ts-expect-error onClick and onclick are one prop
const button = <button onClick={click} onclick={click} />;
// @ts-expect-error acceptCharset and accept-charset are one prop
const form = <form acceptCharset="utf-8" accept-charset="latin1" />;
// @ts-expect-error ariaLabel and aria-label are one prop
const aria = <div ariaLabel="name" aria-label="other" />;
// @ts-expect-error className and class are one prop
const classes = <div className="on" class="off" />;

export const duplicateSpellings = {
	labelFor,
	labelAttr,
	buttonClick,
	buttonAttr,
	formCharset,
	formAttr,
	named,
	namedAttr,
	className,
	classAttr,
	label,
	button,
	form,
	aria,
	classes,
};
