import { describe, expect, it } from "vitest";
import { containsExecutableUri, isUriBearingKey } from "./artifact-uri";

describe("application artifact URI policy", () => {
	it("recognizes only URI-bearing fields, case insensitively", () => {
		for (const key of ["href", "SRC", "action", "formAction", "XLINK:HREF"])
			expect(isUriBearingKey(key)).toBe(true);
		for (const key of ["codebase", "data-href", "srcset", "actionName", ""])
			expect(isUriBearingKey(key)).toBe(false);
	});
	it("rejects executable URI schemes and control-character obfuscation", () => {
		for (const uri of [
			"javascript:alert(1)",
			"VBScript:evil",
			"data:text/html,evil",
			"data:image/svg+xml;utf8,evil",
			"data:application/xhtml+xml",
			" \u0000Ja\tVa\nSc\rRiPt\u007f:evil",
		])
			expect(containsExecutableUri(uri)).toBe(true);
		for (const uri of [
			"https://example.test",
			"/image.png",
			"data:image/png;base64,ok",
			"data:text/htmlish,ok",
			"mailto:hello@example.test",
			"https://example.test/javascript:ok",
			"https://example.test/data:text/html,ok",
			"",
			1,
			null,
			{},
		])
			expect(containsExecutableUri(uri)).toBe(false);
	});
	it("uses join-like analysis for dense canonical JSON arrays without stringifying objects", () => {
		expect(containsExecutableUri([["javascript:evil"]])).toBe(true);
		expect(containsExecutableUri([null, "javascript:evil"])).toBe(false);
		expect(containsExecutableUri(["java", "script:evil"])).toBe(false);
		expect(containsExecutableUri([[""], "javascript:evil"])).toBe(false);
		expect(containsExecutableUri([{}])).toBe(false);
		expect(containsExecutableUri([Object.create(null)])).toBe(false);
		expect(containsExecutableUri([{ length: 1, 0: "javascript:evil" }])).toBe(
			false,
		);
		expect(containsExecutableUri(["data:text/html", null])).toBe(true);
	});
});
