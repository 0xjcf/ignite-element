import { strToU8, zipSync } from "fflate";
import manifest from "../../examples/light-switch/package.json?raw";
import readme from "../../examples/light-switch/README.md?raw";
import html from "../../examples/light-switch/index.html?raw";
import source from "../../examples/light-switch/src/light-switch.tsx?raw";
import styles from "../../examples/light-switch/src/light-switch.css?raw";

export function GET() {
	const files = {
		"package.json": strToU8(manifest),
		"README.md": strToU8(readme),
		"index.html": strToU8(html),
		"src/light-switch.tsx": strToU8(source),
		"src/light-switch.css": strToU8(styles),
	};
	const archive = zipSync(files, { mtime: new Date("2000-01-01T00:00:00Z") });
	return new Response(new Uint8Array(archive), {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": 'attachment; filename="ignite-light-switch.zip"',
		},
	});
}
