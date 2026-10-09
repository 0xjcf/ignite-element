/**
 * Codecov's clover parser still uses the old Istanbul meaning of
 * truecount/falsecount: the two sides of a branch. istanbul-reports 3
 * writes covered and uncovered counts instead, so a fully covered
 * branch is reported as a partial. Rewrite those attributes so a line
 * is a hit only when every branch on it ran.
 */
import fs from "node:fs";

const coveragePath = new URL(
	"../coverage/coverage-final.json",
	import.meta.url,
);
const cloverPath = new URL("../coverage/clover.xml", import.meta.url);

const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));

function branchesByLine(data) {
	const byLine = new Map();
	for (const [id, meta] of Object.entries(data.branchMap ?? {})) {
		const line = meta.loc?.start?.line;
		if (!line) continue;
		const hits = data.b?.[id] ?? [];
		const stat = byLine.get(line) ?? { covered: 0, total: 0 };
		for (const hit of hits) {
			stat.total += 1;
			if (hit > 0) stat.covered += 1;
		}
		byLine.set(line, stat);
	}
	return byLine;
}

const byPath = new Map(
	Object.entries(coverage).map(([file, data]) => [file, branchesByLine(data)]),
);

function countsFor(stat) {
	if (!stat || stat.total === 0 || stat.covered === 0) {
		return { truecount: 0, falsecount: 0 };
	}
	if (stat.covered === stat.total) {
		return { truecount: 1, falsecount: 1 };
	}
	return { truecount: 1, falsecount: 0 };
}

let xml = fs.readFileSync(cloverPath, "utf8");
xml = xml.replace(
	/<file\b([^>]*?)\bpath="([^"]+)"([^>]*)>([\s\S]*?)<\/file>/g,
	(block, before, filePath, after, inner) => {
		const stats = byPath.get(filePath);
		if (!stats) return block;
		const nextInner = inner.replace(/<line\b([^>]*?)\/>/g, (lineTag) => {
			if (!lineTag.includes('type="cond"')) return lineTag;
			const num = /num="(\d+)"/.exec(lineTag)?.[1];
			if (!num) return lineTag;
			const { truecount, falsecount } = countsFor(stats.get(Number(num)));
			return lineTag
				.replace(/truecount="\d+"/, `truecount="${truecount}"`)
				.replace(/falsecount="\d+"/, `falsecount="${falsecount}"`);
		});
		return `<file${before}path="${filePath}"${after}>${nextInner}</file>`;
	},
);

fs.writeFileSync(cloverPath, xml);
