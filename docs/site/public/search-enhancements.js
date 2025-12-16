const suggestions = [
	{ label: "Installation", query: "installation" },
	{ label: "State adapters", query: "state adapters" },
	{ label: "igniteCore API", query: "igniteCore" },
	{ label: "Renderers", query: "renderers" },
	{ label: "Migration v1 → v2", query: "migration v2" },
	{ label: "Testing", query: "testing" },
];

const helperText =
	"Tip: / to focus • ↑↓ to navigate • Enter to open • Esc to close";

const buildChips = (root) => {
	const form = root.querySelector(".pagefind-ui__form");
	const input = root.querySelector(".pagefind-ui__search-input");
	if (!form || !input || root.querySelector(".ignite-search-extras")) return;

	const wrapper = document.createElement("div");
	wrapper.className = "ignite-search-extras";

	const chipRow = document.createElement("div");
	chipRow.className = "ignite-search-hints";

	suggestions.forEach(({ label, query }) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.textContent = label;
		btn.addEventListener("click", () => {
			input.value = query;
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.focus();
		});
		chipRow.appendChild(btn);
	});

	const footnote = document.createElement("div");
	footnote.className = "ignite-search-footnote";
	const hintText = document.createElement("span");
	hintText.textContent = helperText;
	const keyGroup = document.createElement("span");
	["Esc", "Enter", "↑ ↓"].forEach((key) => {
		const k = document.createElement("kbd");
		k.textContent = key;
		keyGroup.appendChild(k);
	});
	footnote.appendChild(hintText);
	footnote.appendChild(keyGroup);

	wrapper.appendChild(chipRow);
	wrapper.appendChild(footnote);
	form.insertAdjacentElement("afterend", wrapper);
};

const attachWhenReady = () => {
	const root = document.getElementById("starlight__search");
	if (!root) return false;
	const form = root.querySelector(".pagefind-ui__form");
	if (form) {
		buildChips(root);
		return true;
	}
	return false;
};

if (!attachWhenReady()) {
	const observer = new MutationObserver(() => {
		if (attachWhenReady()) observer.disconnect();
	});
	observer.observe(document.body, { childList: true, subtree: true });
}
