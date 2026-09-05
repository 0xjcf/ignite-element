/** Navigation and required coverage shared by the actual browser audit CLIs. */
export async function navigateForAudit(page, url, options) {
	const response = await page.goto(url, options);
	if (!response?.ok()) {
		throw new Error(
			`Audit navigation failed: HTTP ${response?.status() ?? "no response"} for ${url}`,
		);
	}
}

export async function requireAuditTargets(page, selectors, context) {
	for (const selector of selectors) {
		if ((await page.locator(selector).count()) === 0) {
			throw new Error(`Missing required audit target ${selector} (${context})`);
		}
	}
}
