import type { Plugin } from "vite";

/** Free identifier restored to `process.env.NODE_ENV` after production minification. */
export const DEVTOOLS_NODE_ENV_TOKEN = "__IGNITE_NODE_ENV__";

const preservedSources = [
	"/src/devtools-hook.ts",
	"/src/runtime/devtoolsHook.ts",
];

const tagHelper = `
function __igniteNoteTag(tag,owner,definition,mode){const previous=__igniteTagDefinitions.get(tag);if(mode==="record"){if(previous===void 0)__igniteTagDefinitions.set(tag,{owner,definition});return}if(previous!==void 0&&previous.owner===owner&&previous.definition===definition||__igniteTagWarned.has(tag))return;__igniteTagWarned.add(tag);try{console.warn('[igniteCore] Custom element "'+tag+'" is already defined by a different component. The existing registration was kept.')}catch{}}
const __igniteTagDefinitions=new Map(),__igniteTagWarned=new Set();
`;

type Replacement = {
	label: string;
	from: string;
	to: string;
};

const factoryReplacements: Replacement[] = [
	{
		label: "effect delivery",
		from: `R?.(E.type);
              const Y = { ...E };`,
		to: `R?.(E.type);
              if(process.env.NODE_ENV!=="production"){const devtools=globalThis[Symbol.for("ignite-element.devtools")];devtools?.hook?.event&&devtools.publish?.(y,"effect",E)}
              const Y = { ...E };`,
	},
	{
		label: "headless native delivery",
		from: `E && h.includes(E.type) && A(E);`,
		to: `E && h.includes(E.type) && (process.env.NODE_ENV!=="production"&&((devtools)=>devtools?.hook?.event&&devtools.publish?.(g,"native",E))(globalThis[Symbol.for("ignite-element.devtools")]), A(E));`,
	},
	{
		label: "DOM native delivery",
		from: `const { type: a, ...d } = i;
      !o || !s.active || t.dispatchEvent(`,
		to: `const { type: a, ...d } = i;
      if(process.env.NODE_ENV!=="production"){if(o&&s.active){const devtools=globalThis[Symbol.for("ignite-element.devtools")];devtools?.hook?.event&&devtools.publish?.(e,"native",i)}}
      !o || !s.active || t.dispatchEvent(`,
	},
	{
		label: "existing tag",
		from: `    if (M.get(C))
      return U;`,
		to: `    if (M.get(C)) {
      if(process.env.NODE_ENV!=="production"){devOwner??={};__igniteNoteTag(C,devOwner,f,"existing")}
      return U;
    }`,
	},
	{
		label: "shared tag record",
		from: `return M.define(C, _), U;`,
		to: `if(process.env.NODE_ENV!=="production"){devOwner??={};__igniteNoteTag(C,devOwner,f,"record")}
      return M.define(C, _), U;`,
	},
	{
		label: "isolated tag record",
		from: `return M.define(C, K), U;`,
		to: `if(process.env.NODE_ENV!=="production"){devOwner??={};__igniteNoteTag(C,devOwner,f,"record")}
    return M.define(C, K), U;`,
	},
	{
		label: "factory dev owner",
		from: `let s = !1, o = !1, c = null, i = null, a = null, d = null;`,
		to: `let s = !1, o = !1, c = null, i = null, a = null, d = null, devOwner;`,
	},
];

const rootReplacements: Replacement[] = [
	{
		label: "source-free existing tag",
		from: `  return (t, n) => {
    const { ElementBase: i, registry: r } = l();
    if (r.get(t)) return;`,
		to: `  let devOwner;
  return (t, n) => {
    const { ElementBase: i, registry: r } = l();
    if(process.env.NODE_ENV!=="production"&&r.get(t)){devOwner??={};__igniteNoteTag(t,devOwner,n,"existing")}
    if (r.get(t)) return;`,
	},
	{
		label: "source-free tag record",
		from: `    r.define(t, s);
  };`,
		to: `    r.define(t, s);
    if(process.env.NODE_ENV!=="production"){devOwner??={};__igniteNoteTag(t,devOwner,n,"record")}
  };`,
	},
];

function replaceAll(
	value: string,
	search: string,
	replacement: string,
): string {
	return value.split(search).join(replacement);
}

function preservesNodeEnv(id: string): boolean {
	const normalized = replaceAll(id, "\\", "/");
	return preservedSources.some((source) => normalized.includes(source));
}

function replaceOnce(code: string, replacement: Replacement): string {
	const first = code.indexOf(replacement.from);
	const second =
		first < 0
			? -1
			: code.indexOf(replacement.from, first + replacement.from.length);
	if (first < 0 || second !== -1) {
		throw new Error(
			`preserve-devtools-node-env: expected one ${replacement.label} anchor`,
		);
	}
	return `${code.slice(0, first)}${replacement.to}${code.slice(first + replacement.from.length)}`;
}

function injectGroup(code: string, replacements: Replacement[]): string {
	let next = code;
	for (const replacement of replacements) next = replaceOnce(next, replacement);
	return `${next}${tagHelper}`;
}

/**
 * Call sites are removed before minification so existing entrypoints keep their
 * production sizes. The same checks are written back into those minified chunks.
 * Application bundlers still fold `process.env.NODE_ENV` and drop them.
 */
export function injectDevtoolsCallSites(code: string): string {
	const factoryHits = factoryReplacements.filter((item) =>
		code.includes(item.from),
	).length;
	if (factoryHits === factoryReplacements.length) {
		return injectGroup(code, factoryReplacements);
	}
	if (factoryHits !== 0) {
		throw new Error(
			"preserve-devtools-node-env: factory devtools anchors changed",
		);
	}
	const rootHits = rootReplacements.filter((item) =>
		code.includes(item.from),
	).length;
	if (rootHits === rootReplacements.length)
		return injectGroup(code, rootReplacements);
	if (rootHits !== 0) {
		throw new Error(
			"preserve-devtools-node-env: root devtools anchors changed",
		);
	}
	return code;
}

/**
 * The library build inlines `process.env.NODE_ENV` as production, which would
 * publish `installDevtoolsHook` as a permanent no-op. The hook entry keeps a
 * real member expression, and the other entrypoints get that check back after
 * minification, so application bundlers can fold it themselves.
 */
export function preserveDevtoolsNodeEnv(): Plugin {
	return {
		name: "preserve-devtools-node-env",
		apply: "build",
		enforce: "pre",
		transform(code, id) {
			if (!preservesNodeEnv(id) || !code.includes("process.env.NODE_ENV")) {
				return null;
			}
			return replaceAll(code, "process.env.NODE_ENV", DEVTOOLS_NODE_ENV_TOKEN);
		},
		generateBundle(_options, bundle) {
			for (const item of Object.values(bundle)) {
				if (item.type !== "chunk") continue;
				if (item.code.includes(DEVTOOLS_NODE_ENV_TOKEN)) {
					item.code = replaceAll(
						item.code,
						DEVTOOLS_NODE_ENV_TOKEN,
						"process.env.NODE_ENV",
					);
				}
				item.code = injectDevtoolsCallSites(item.code);
			}
		},
	};
}
