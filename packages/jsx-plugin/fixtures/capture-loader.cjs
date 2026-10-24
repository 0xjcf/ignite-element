const fs = require("node:fs");
const path = require("node:path");

module.exports = function capture(source) {
	const out = path.join(this.rootContext || process.cwd(), "transformed.js");
	fs.mkdirSync(path.dirname(this._compiler?.outputPath || out), {
		recursive: true,
	});
	const target = this._compiler?.outputPath
		? path.join(this._compiler.outputPath, "transformed.js")
		: out;
	fs.writeFileSync(target, source);
	return "module.exports = {};\n";
};
