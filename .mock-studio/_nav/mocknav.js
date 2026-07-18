/* mock-studio demo navigator — drop-in floating screen switcher. Configure via window.MOCK_NAV. */
(function () {
	var cfg = window.MOCK_NAV || { groups: [] };
	if (/[?&]capture/.test(location.search)) return;
	var css = `
	.mnav{position:fixed;right:18px;bottom:18px;z-index:2147483000;font-family:var(--font-sans,system-ui),system-ui;font-size:13px;line-height:1.35}
	.mnav *{box-sizing:border-box}.mnav-fab{position:relative;width:46px;height:46px;border-radius:13px;border:1px solid var(--border);background:var(--surface-raised);color:var(--foreground);box-shadow:var(--shadow-lg);cursor:pointer;display:grid;place-items:center;font-size:18px}
	.mnav-fab:hover{border-color:var(--primary)}.mnav-fab .badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:9px;background:var(--primary);color:var(--primary-ink);font-size:9px;font-weight:700;display:grid;place-items:center;padding:0 4px}
	.mnav-panel{position:absolute;right:0;bottom:56px;width:240px;max-height:min(72vh,580px);overflow:auto;background:var(--surface-raised);color:var(--foreground);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);padding:6px}.mnav[data-open="false"] .mnav-panel{display:none}
	.mnav-hd{display:flex;align-items:center;gap:8px;padding:8px 8px 9px;border-bottom:1px solid var(--border);margin-bottom:3px}.mnav-hd .t{font-size:12px;font-weight:700}.mnav-hd .s{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}.mnav-hd .x{margin-left:auto;border:0;background:transparent;color:var(--muted);font-size:17px;cursor:pointer;line-height:1;padding:0 3px}
	.mnav-grp{font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:9px 8px 4px}.mnav-item{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:transparent;color:var(--foreground);border-radius:9px;padding:7px 8px;cursor:pointer;text-decoration:none;font-size:12.5px;font-family:inherit}.mnav-item:hover{background:var(--surface-hover)}.mnav-item.on{background:var(--primary-wash);font-weight:700}.mnav-item .ic{width:17px;text-align:center;color:var(--muted);flex:none}.mnav-item.on .ic{color:var(--primary)}.mnav-item .ex{margin-left:auto;font-size:10px;color:var(--muted)}`;
	var style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);
	var nScreens = 0;
	(cfg.groups || []).forEach(function (g) {
		(g.items || []).forEach(function () {
			nScreens++;
		});
	});
	var root = document.createElement("div");
	root.className = "mnav";
	root.setAttribute("data-open", cfg.open === false ? "false" : "true");
	var panel = document.createElement("div");
	panel.className = "mnav-panel";
	panel.setAttribute("role", "navigation");
	panel.setAttribute("aria-label", "Mock navigation");
	var hd = document.createElement("div");
	hd.className = "mnav-hd";
	hd.innerHTML =
		'<span class="t">' +
		(cfg.title || "Mocks") +
		'</span><span class="s">' +
		(cfg.subtitle || "") +
		'</span><button class="x" aria-label="Collapse">×</button>';
	panel.appendChild(hd);
	(cfg.groups || []).forEach(function (g) {
		if (g.label) {
			const h = document.createElement("div");
			h.className = "mnav-grp";
			h.textContent = g.label;
			panel.appendChild(h);
		}
		(g.items || []).forEach(function (it) {
			var el = document.createElement(it.href ? "a" : "button");
			el.className = "mnav-item";
			if (it.id) el.setAttribute("data-screen", it.id);
			if (it.current || (it.id && it.id === cfg.current))
				el.classList.add("on");
			el.innerHTML =
				'<span class="ic">' +
				(it.icon || "▸") +
				"</span><span>" +
				it.label +
				"</span>" +
				(it.href ? '<span class="ex">↗</span>' : "");
			if (it.href) el.href = it.href;
			else
				el.addEventListener("click", function () {
					try {
						cfg.onSelect && cfg.onSelect(it.id);
					} catch (e) {}
					setActive(it.id);
				});
			panel.appendChild(el);
		});
	});
	var fab = document.createElement("button");
	fab.className = "mnav-fab";
	fab.setAttribute("aria-label", "Mock navigation");
	fab.title = "Mock navigation (" + nScreens + " screens)";
	fab.innerHTML =
		"▥" + (nScreens ? '<span class="badge">' + nScreens + "</span>" : "");
	root.appendChild(panel);
	root.appendChild(fab);
	document.body.appendChild(root);
	function setActive(id) {
		panel.querySelectorAll(".mnav-item[data-screen]").forEach(function (x) {
			x.classList.toggle("on", x.getAttribute("data-screen") === id);
		});
	}
	window.mnavSetActive = setActive;
	fab.addEventListener("click", function () {
		root.setAttribute(
			"data-open",
			root.getAttribute("data-open") === "true" ? "false" : "true",
		);
	});
	hd.querySelector(".x").addEventListener("click", function () {
		root.setAttribute("data-open", "false");
	});
	window.addEventListener("hashchange", function () {
		var h = (location.hash || "").replace("#", "");
		if (h) setActive(h);
	});
})();
