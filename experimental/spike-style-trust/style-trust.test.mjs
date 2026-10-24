import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as optionA from "./src/option-a.mjs";
import * as optionB from "./src/option-b.mjs";
import * as optionC from "./src/option-c.mjs";
import { AUTHOR_WARNING } from "./src/policy.mjs";
import { transformAuthorStyle } from "./src/transform.mjs";

const FONT = `
@font-face { font-family: Card; src: url(https://cdn.example/card.woff2); }
.card { background-image: url(https://cdn.example/a.png); }
`;
const IMPORT_SHEET = `@import "https://cdn.example/a.css"; .ok { color: red }`;
const IMAGE_SET = `.a { background: image-set(url(https://cdn.example/a.png) 1x) }`;
const EXPRESSION = `.a { color: red; width: expression(alert(1)) }`;
const BREAKOUT = `.a { color: red } </style><img src=x>`;
const RANGE = `@media (width < 600px) { .a { color: red } }`;
const SIBLING = `.ok { color: red } .bad { background: url(https://cdn.example/a.png) }`;

function noPublicHelpers(namespace, name) {
	assert.equal(namespace.safeUrl, undefined, name);
	assert.equal(namespace.safeSpread, undefined, name);
	assert.equal(namespace.trustedStyle, undefined, name);
}

describe("no public helpers", () => {
	it("does not export safeUrl, safeSpread, or trustedStyle", () => {
		noPublicHelpers(optionA, "A");
		noPublicHelpers(optionB, "B");
		noPublicHelpers(optionC, "C");
	});
});

describe("url attributes and handlers, all options", () => {
	for (const render of [optionA.renderA, optionB.renderB, optionC.renderC]) {
		it(`${render.name} drops javascript: href and string handlers without a helper`, () => {
			const clicked = () => {};
			const result = render({
				props: {
					href: "javascript:alert(1)",
					src: "https://cdn.example/a.png",
					onClick: clicked,
					onclick: "alert(1)",
					id: "card",
				},
			});
			assert.equal(result.attrs.href, undefined);
			assert.equal(result.attrs.src, "https://cdn.example/a.png");
			assert.deepEqual(result.listeners, ["onClick"]);
			assert.equal(result.attrs.id, "card");
		});

		it(`${render.name} keeps a spread function handler, because it looks like onClick`, () => {
			const untrusted = { onClick: () => {}, href: "javascript:alert(1)" };
			const result = render({ props: { ...untrusted, id: "card" } });
			assert.equal(result.listeners.includes("onClick"), true);
			assert.equal(result.attrs.href, undefined);
		});
	}
});

describe("A react-style, no loader filter", () => {
	it("keeps url(), @import, image-set, and a font src in style and in <style>", () => {
		const result = optionA.renderA({
			style: { backgroundImage: "url(https://cdn.example/a.png)" },
			styleChildren: FONT,
		});
		assert.match(result.styleAttribute.backgroundImage, /url\(https:\/\/cdn\.example\/a\.png\)/);
		assert.match(result.styleElement, /url\(https:\/\/cdn\.example\/card\.woff2\)/);
		assert.match(
			optionA.renderA({ styleChildren: IMPORT_SHEET }).styleElement,
			/@import/,
		);
		assert.match(
			optionA.renderA({ styleChildren: IMAGE_SET }).styleElement,
			/image-set/,
		);
	});

	it("drops expression(), behavior, -moz-binding, and a style breakout", () => {
		const result = optionA.renderA({
			style: "color: red; width: expression(alert(1)); behavior: url(x); -moz-binding: url(x)",
			styleChildren: BREAKOUT,
		});
		assert.match(result.styleAttribute, /color:\s*red/);
		assert.doesNotMatch(result.styleAttribute, /expression\s*\(/);
		assert.doesNotMatch(result.styleAttribute, /behavior/);
		assert.doesNotMatch(result.styleAttribute, /-moz-binding/);
		assert.equal(result.styleElement, "");
		assert.equal(optionA.renderA({ styleChildren: EXPRESSION }).styleElement.includes("expression"), false);
	});

	it("keeps a range query", () => {
		assert.match(optionA.renderA({ styleChildren: RANGE }).styleElement, /width < 600px/);
	});
});

describe("B runtime author sheet", () => {
	it("passes url() through <style> and still filters style={}", () => {
		const result = optionB.renderB({
			style: { backgroundImage: "url(https://cdn.example/a.png)", color: "red" },
			styleChildren: SIBLING,
		});
		assert.equal(result.styleAttribute.backgroundImage, undefined);
		assert.equal(result.styleAttribute.color, "red");
		assert.match(result.styleElement, /url\(https:\/\/cdn\.example\/a\.png\)/);
		assert.match(result.styleElement, /\.ok/);
	});

	it("drops expression() and a breakout inside <style>, and keeps the font", () => {
		assert.equal(optionB.renderB({ styleChildren: BREAKOUT }).styleElement, "");
		const font = optionB.renderB({ styleChildren: `${FONT}\n.a { width: expression(1) }` });
		assert.match(font.styleElement, /woff2/);
		assert.doesNotMatch(font.styleElement, /expression\s*\(/);
	});

	it("keeps an interpolated prop inside <style> and warns in dev", () => {
		const image = "https://evil.example/steal.png";
		const interpolated = `.card { background: url(${image}) }`;
		const quiet = optionB.renderB({ styleChildren: interpolated });
		const loud = optionB.renderB({ styleChildren: interpolated }, { dev: true });
		assert.match(quiet.styleElement, /evil\.example/);
		assert.deepEqual(quiet.warnings, []);
		assert.match(loud.styleElement, /evil\.example/);
		assert.deepEqual(loud.warnings, [AUTHOR_WARNING]);
	});

	it("puts data on a custom property and still rejects a url() value there", () => {
		const color = optionB.renderB({
			style: { "--card": "rebeccapurple" },
			styleChildren: ".card { background: var(--card) }",
		});
		assert.equal(color.styleAttribute["--card"], "rebeccapurple");
		assert.match(color.styleElement, /var\(--card\)/);
		const remote = optionB.renderB({
			style: { "--card": "url(https://evil.example/a.png)" },
			styleChildren: ".card { background: var(--card) }",
		});
		assert.equal(remote.styleAttribute["--card"], undefined);
	});

	it("does not warn for a stylesheet with no remote load", () => {
		const result = optionB.renderB(
			{ styleChildren: ".card { color: red }" },
			{ dev: true },
		);
		assert.deepEqual(result.warnings, []);
	});
});

describe("C compile step", () => {
	it("marks a const string and a no-substitution template, not an interpolation", () => {
		const literal = transformAuthorStyle(`
			const cardCss = \`
				.card { background: url(https://cdn.example/a.png); }
			\`;
			export function Card() {
				return <style>{cardCss}</style>;
			}
		`);
		assert.equal(literal.marked, true);
		assert.match(literal.code, /igniteAuthorStyle\(/);
		assert.match(literal.code, /cdn\.example\/a\.png/);
		assert.match(literal.code, /#ignite\/author-style/);

		const inline = transformAuthorStyle(
			"export function Card() { return <style>{`.a { color: red }`}</style>; }",
		);
		assert.equal(inline.marked, true);

		const interpolated = transformAuthorStyle(`
			export function Card(props) {
				return <style>{\`.card { background: url(\${props.image}) }\`}</style>;
			}
		`);
		assert.equal(interpolated.marked, false);
		assert.equal(interpolated.code.includes("igniteAuthorStyle"), false);

		const fromProps = transformAuthorStyle(`
			export function Card(props) {
				return <style>{props.css}</style>;
			}
		`);
		assert.equal(fromProps.marked, false);
	});

	it("does not mark a parameter that shadows a const", () => {
		const result = transformAuthorStyle(`
			const cardCss = ".a { background: url(https://cdn.example/a.png) }";
			export function Card(cardCss) {
				return <style>{cardCss}</style>;
			}
		`);
		assert.equal(result.marked, false);
	});

	it("keeps a marked sheet's url() and filters an unmarked string", () => {
		const css = ".card { background: url(https://cdn.example/a.png) }";
		const marked = optionC.renderC({
			styleChildren: optionC.igniteAuthorStyle(css),
		});
		assert.match(marked.styleElement, /cdn\.example/);
		const data = optionC.renderC({ styleChildren: css });
		assert.equal(data.styleElement.includes("url("), false);
		assert.match(data.styleElement, /\.card/);
	});

	it("drops a forged symbol and a style breakout on a marked sheet", () => {
		const forged = {
			[Symbol.for("ignite-element.authorStyle")]:
				"background: url(https://evil.example/a.png)",
		};
		const result = optionC.renderC({ styleChildren: forged });
		assert.equal(result.styleElement.includes("url("), false);
		const broken = optionC.renderC({
			styleChildren: optionC.igniteAuthorStyle(BREAKOUT),
		});
		assert.equal(broken.styleElement, "");
	});

	it("filters style={} even when the sheet was marked", () => {
		const result = optionC.renderC({
			style: { backgroundImage: "url(https://cdn.example/a.png)", color: "red" },
			styleChildren: optionC.igniteAuthorStyle(FONT),
		});
		assert.equal(result.styleAttribute.backgroundImage, undefined);
		assert.equal(result.styleAttribute.color, "red");
		assert.match(result.styleElement, /woff2/);
	});

	it("rejects a non-string mark", () => {
		assert.throws(
			() => optionC.igniteAuthorStyle(1),
			/igniteAuthorStyle expects a string/,
		);
	});
});
