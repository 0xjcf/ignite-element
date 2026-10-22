import { strToU8, zipSync } from "fflate";
import html from "../../examples/light-switch/index.html?raw";
import manifest from "../../examples/light-switch/package.json?raw";
import readme from "../../examples/light-switch/README.md?raw";
import cssTypes from "../../examples/light-switch/src/env.d.ts?raw";
import styles from "../../examples/light-switch/src/light-switch.css?raw";
import source from "../../examples/light-switch/src/light-switch.tsx?raw";

export function GET() {
	const files = {
		"package.json": strToU8(manifest),
		"README.md": strToU8(readme),
		"index.html": strToU8(html),
		"src/light-switch.tsx": strToU8(source),
		"src/light-switch.css": strToU8(styles),
		"src/env.d.ts": strToU8(cssTypes),
	};
	const archive = zipSync(files, { mtime: new Date("2000-01-01T00:00:00Z") });
	return new Response(new Uint8Array(archive), {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": 'attachment; filename="ignite-light-switch.zip"',
		},
	});
}
