import { isIssueOrPRListPage } from "../lib/page-detect";

const LABEL_ROW_CLASS = "better-github-label-prefix";
const HIDDEN_ORIGINAL_CLASS = "better-github-labels-hidden";

export function injectPRLabelPosition(): void {
	if (!isIssueOrPRListPage()) return;

	// Skip if already injected
	if (document.querySelectorAll(`.${LABEL_ROW_CLASS}`).length > 0) return;

	const rows = document.querySelectorAll("[id^='issue_']");

	for (const row of rows) {
		const labels = row.querySelectorAll<HTMLAnchorElement>("a.IssueLabel");
		if (labels.length === 0) continue;

		const titleLink =
			row.querySelector<HTMLElement>("[id^='issue_'][id$='_link']") ||
			row.querySelector<HTMLElement>("a.Link--primary");
		if (!titleLink) continue;

		const labelRow = document.createElement("div");
		labelRow.className = LABEL_ROW_CLASS;

		for (const label of labels) {
			const clone = label.cloneNode(true) as HTMLElement;
			labelRow.appendChild(clone);
			label.classList.add(HIDDEN_ORIGINAL_CLASS);
		}

		// Find the meta line (contains "opened X ago") using relative-time element
		const relativeTime = row.querySelector("relative-time");
		const metaLine = relativeTime?.closest("div");

		if (metaLine && row.contains(metaLine) && metaLine !== row) {
			// Insert after the meta line — labels become the 3rd line
			metaLine.insertAdjacentElement("afterend", labelRow);
		} else {
			// Fallback: insert after title link
			titleLink.insertAdjacentElement("afterend", labelRow);
		}
	}
}

export function cleanupPRLabelPosition(): void {
	document.querySelectorAll(`.${HIDDEN_ORIGINAL_CLASS}`).forEach((el) => {
		el.classList.remove(HIDDEN_ORIGINAL_CLASS);
	});
}
