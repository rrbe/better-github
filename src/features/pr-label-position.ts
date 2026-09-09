import { isCompactPRRow, TRAILING_LABELS_SELECTOR } from "../lib/pr-list-dom";
import { isIssueOrPRListPage } from "../lib/page-detect";
import { insertInfoRowItem } from "../lib/info-row";

const LABEL_WRAPPER_CLASS = "better-github-label-prefix";
const HIDDEN_ORIGINAL_CLASS = "better-github-labels-hidden";

/** Process a trailing badges container (new React DOM). */
function processTrailingBadges(container: HTMLElement): void {
	const row = container.closest<HTMLElement>("li");
	if (!row || isCompactPRRow(row) || row.querySelector(`.${LABEL_WRAPPER_CLASS}`)) return;

	const labels = container.querySelectorAll<HTMLElement>("a, button");
	if (labels.length === 0) return;

	const wrapper = document.createElement("span");
	wrapper.className = LABEL_WRAPPER_CLASS;

	for (const label of labels) {
		const clone = label.cloneNode(true) as HTMLElement;
		// React handlers are not copied by cloneNode. Forward button activation
		// to the original so GitHub keeps its native query/filter behavior.
		if (label instanceof HTMLButtonElement) {
			clone.tabIndex = 0;
			clone.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				label.click();
			});
		}
		wrapper.appendChild(clone);
	}

	if (!insertInfoRowItem(row, "labels", wrapper)) return;
	container.classList.add(HIDDEN_ORIGINAL_CLASS);
}

/** Process old Turbo DOM rows (PR list). */
function processOldRows(): void {
	const rows = document.querySelectorAll<HTMLElement>("[id^='issue_']");

	for (const row of rows) {
		if (row.querySelector(`.${LABEL_WRAPPER_CLASS}`)) continue;

		const labels = row.querySelectorAll<HTMLElement>("a.IssueLabel");
		if (labels.length === 0) continue;

		const wrapper = document.createElement("span");
		wrapper.className = LABEL_WRAPPER_CLASS;

		for (const label of labels) {
			wrapper.appendChild(label.cloneNode(true) as HTMLElement);
		}

		if (!insertInfoRowItem(row, "labels", wrapper)) continue;
		for (const label of labels) label.classList.add(HIDDEN_ORIGINAL_CLASS);
	}
}

let listenerActive = false;

function onLabelsAnimation(event: AnimationEvent): void {
	if (event.animationName !== "better-github-detect-labels" || !isIssueOrPRListPage()) return;
	processTrailingBadges(event.target as HTMLElement);
}

export function injectPRLabelPosition(): void {
	if (!isIssueOrPRListPage()) return;

	// Old DOM (PR list / Turbo) — process once
	processOldRows();

	// Handle containers already rendered before the animation listener starts.
	for (const container of document.querySelectorAll<HTMLElement>(TRAILING_LABELS_SELECTOR)) {
		processTrailingBadges(container);
	}

	// New DOM (React) — CSS animation fires when trailingBadgesContainer appears.
	// Naturally handles React re-rendering: recreated elements trigger new animations.
	if (!listenerActive) {
		document.addEventListener("animationstart", onLabelsAnimation);
		listenerActive = true;
	}
}

export function cleanupPRLabelPosition(): void {
	document.removeEventListener("animationstart", onLabelsAnimation);
	listenerActive = false;
	document.querySelectorAll(`.${HIDDEN_ORIGINAL_CLASS}`).forEach((el) => {
		el.classList.remove(HIDDEN_ORIGINAL_CLASS);
	});
}
