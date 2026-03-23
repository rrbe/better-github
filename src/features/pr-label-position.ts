import { isIssueOrPRListPage } from "../lib/page-detect";
import { getOrCreateInfoRow } from "../lib/info-row";

const LABEL_WRAPPER_CLASS = "better-github-label-prefix";
const HIDDEN_ORIGINAL_CLASS = "better-github-labels-hidden";

export function injectPRLabelPosition(): void {
	if (!isIssueOrPRListPage()) return;

	// Skip if already injected
	if (document.querySelectorAll(`.${LABEL_WRAPPER_CLASS}`).length > 0) return;

	const rows = document.querySelectorAll("[id^='issue_']");

	for (const row of rows) {
		const labels = row.querySelectorAll<HTMLAnchorElement>("a.IssueLabel");
		if (labels.length === 0) continue;

		const infoRow = getOrCreateInfoRow(row);
		if (!infoRow) continue;

		const wrapper = document.createElement("span");
		wrapper.className = LABEL_WRAPPER_CLASS;

		for (const label of labels) {
			const clone = label.cloneNode(true) as HTMLElement;
			wrapper.appendChild(clone);
			label.classList.add(HIDDEN_ORIGINAL_CLASS);
		}

		// Insert labels at the beginning of the info row (before branch/review badges)
		infoRow.insertBefore(wrapper, infoRow.firstChild);
	}
}

export function cleanupPRLabelPosition(): void {
	document.querySelectorAll(`.${HIDDEN_ORIGINAL_CLASS}`).forEach((el) => {
		el.classList.remove(HIDDEN_ORIGINAL_CLASS);
	});
}
