export const CSP_NONCE = "igniteCspSpike1";

/**
 * One document that tries each style and Trusted Types sink the
 * library or its optional renderer can reach. The script itself is
 * nonced so it is allowed to run and record the refusals.
 */
export function matrixPage(nonce: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CSP matrix</title>
</head>
<body>
<script type="module" nonce="${nonce}">
const results = [];
function takeNew(start) {
  return window.__cspViolations.slice(start).map((event) => ({
    directive: event.effectiveDirective,
    blocked: event.blockedURI,
    sample: String(event.sample || "").slice(0, 80),
    line: event.lineNumber,
  }));
}
async function probe(id, fn) {
  const start = window.__cspViolations.length;
  let error = null;
  let note = null;
  try {
    note = await fn();
  } catch (caught) {
    error = caught && caught.name ? caught.name + ": " + caught.message : String(caught);
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  results.push({ id, error, note, events: takeNew(start) });
}
await probe("external-link", async () => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/csp-matrix.css";
  document.head.append(link);
  await new Promise((resolve) => {
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
  });
  const el = document.createElement("div");
  el.className = "spike-external";
  document.body.append(el);
  return getComputedStyle(el).color;
});
await probe("style-element", () => {
  const style = document.createElement("style");
  style.textContent = ".spike { color: red }";
  document.head.append(style);
  const el = document.createElement("div");
  el.className = "spike";
  document.body.append(el);
  return getComputedStyle(el).color;
});
await probe("style-element-nonce", () => {
  const style = document.createElement("style");
  style.setAttribute("nonce", ${JSON.stringify(nonce)});
  style.textContent = ".spike-nonce { color: blue }";
  document.head.append(style);
  const el = document.createElement("div");
  el.className = "spike-nonce";
  document.body.append(el);
  return getComputedStyle(el).color;
});
await probe("style-attribute", () => {
  const el = document.createElement("div");
  document.body.append(el);
  el.setAttribute("style", "color: red");
  return getComputedStyle(el).color;
});
await probe("css-text", () => {
  const el = document.createElement("div");
  document.body.append(el);
  el.style.cssText = "color: red";
  return el.style.color + " computed " + getComputedStyle(el).color;
});
await probe("set-property", () => {
  const el = document.createElement("div");
  document.body.append(el);
  el.style.setProperty("color", "red");
  return el.style.color + " computed " + getComputedStyle(el).color;
});
await probe("adopted-replace-sync", () => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(".spike-adopted { color: red }");
  document.adoptedStyleSheets = [sheet];
  const el = document.createElement("div");
  el.className = "spike-adopted";
  document.body.append(el);
  return getComputedStyle(el).color;
});
await probe("adopted-insert-rule", () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule(".spike-rule { color: red }", 0);
  document.adoptedStyleSheets = [sheet];
});
await probe("adopted-replace", async () => {
  const sheet = new CSSStyleSheet();
  await sheet.replace(".spike-async { color: red }");
  document.adoptedStyleSheets = [sheet];
});
await probe("inner-html", () => {
  const el = document.createElement("div");
  el.innerHTML = "<b>x</b>";
});
await probe("outer-html", () => {
  const el = document.createElement("div");
  document.body.append(el);
  el.outerHTML = "<span>x</span>";
});
await probe("insert-adjacent-html", () => {
  const el = document.createElement("div");
  document.body.append(el);
  el.insertAdjacentHTML("beforeend", "<span>x</span>");
});
await probe("create-contextual-fragment", () => {
  const range = document.createRange();
  range.selectNode(document.body);
  range.createContextualFragment("<span>x</span>");
});
await probe("iframe-srcdoc", () => {
  const frame = document.createElement("iframe");
  frame.srcdoc = "<p>x</p>";
  document.body.append(frame);
});
await probe("eval-call", () => {
  (0, eval)("1");
});
await probe("new-function", () => {
  const made = new Function("return 1");
  made();
});
await probe("string-set-timeout", () => {
  setTimeout("void 0", 0);
});
await probe("document-write", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const child = frame.contentDocument;
  if (!child) throw new Error("iframe document missing");
  const childEvents = [];
  child.addEventListener("securitypolicyviolation", (event) => {
    childEvents.push({
      directive: event.effectiveDirective,
      blocked: event.blockedURI,
      sample: String(event.sample || "").slice(0, 80),
      line: event.lineNumber,
    });
  });
  try {
    child.open();
    child.write("<p>x</p>");
    child.close();
  } finally {
    for (const event of childEvents) window.__cspViolations.push(event);
  }
});
await probe("policy-lit-html", () => {
  trustedTypes.createPolicy("lit-html", { createHTML: (value) => value });
});
await probe("policy-ignite-inner-html", () => {
  const policy = trustedTypes.createPolicy("ignite", {
    createHTML: (value) => value,
    createScript: (value) => value,
  });
  window.__ignitePolicy = policy;
  const el = document.createElement("div");
  el.innerHTML = policy.createHTML("<b>ok</b>");
  return el.innerHTML;
});
await probe("policy-ignite-eval", () => {
  return String((0, eval)(window.__ignitePolicy.createScript("40+2")));
});
window.__cspReport = results;
window.__cspDone = true;
</script>
</body>
</html>`;
}
