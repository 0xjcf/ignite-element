// Keep native table semantics inside a named, keyboard-scrollable region.
// Applied at build time to current and archived Markdown/MDX alike.
export default function scrollableTables() {
	return (tree) => {
		function visit(node) {
			if (!node.children) return;
			node.children = node.children.map((child) => {
				if (child.type === "element" && child.tagName === "table") {
					const text = (entry) =>
						entry.value || entry.children?.map(text).join("") || "";
					const heading = child.children.find(
						(entry) => entry.tagName === "thead",
					);
					const columns = heading?.children
						.find((entry) => entry.tagName === "tr")
						?.children.filter((entry) => entry.tagName === "th")
						.map(text);
					return {
						type: "element",
						tagName: "div",
						properties: {
							className: ["table-scroll"],
							tabIndex: 0,
							role: "region",
							ariaLabel: columns?.length
								? `Table: ${columns.join(", ")}`
								: "Scrollable table",
						},
						children: [child],
					};
				}
				visit(child);
				return child;
			});
		}
		visit(tree);
	};
}
