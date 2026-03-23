import { isIssueOrPRListPage } from "../lib/page-detect";
import { getOrCreateInfoRow } from "../lib/info-row";

const LABEL_WRAPPER_CLASS = "better-github-label-prefix";
const HIDDEN_ORIGINAL_CLASS = "better-github-labels-hidden";

/** Process a trailing badges container (new React DOM). */
function processTrailingBadges(container: HTMLElement): void {
	const row = container.closest<HTMLElement>("li[role='listitem']");
	if (!row || row.querySelector(`.${LABEL_WRAPPER_CLASS}`)) return;

	const labels = container.querySelectorAll<HTMLElement>("a");
	if (labels.length === 0) return;

	const infoRow = getOrCreateInfoRow(row);
	if (!infoRow) return;

	const wrapper = document.createElement("span");
	wrapper.className = LABEL_WRAPPER_CLASS;

	for (const label of labels) {
		wrapper.appendChild(label.cloneNode(true) as HTMLElement);
	}

	container.classList.add(HIDDEN_ORIGINAL_CLASS);
	infoRow.insertBefore(wrapper, infoRow.firstChild);
}

/** Process old Turbo DOM rows (PR list). */
function processOldRows(): void {
	const rows = document.querySelectorAll<HTMLElement>("[id^='issue_']");

	for (const row of rows) {
		if (row.querySelector(`.${LABEL_WRAPPER_CLASS}`)) continue;

		const labels = row.querySelectorAll<HTMLElement>("a.IssueLabel");
		if (labels.length === 0) continue;

		const infoRow = getOrCreateInfoRow(row);
		if (!infoRow) continue;

		const wrapper = document.createElement("span");
		wrapper.className = LABEL_WRAPPER_CLASS;

		for (const label of labels) {
			wrapper.appendChild(label.cloneNode(true) as HTMLElement);
			label.classList.add(HIDDEN_ORIGINAL_CLASS);
		}

		infoRow.insertBefore(wrapper, infoRow.firstChild);
	}
}

let listenerActive = false;

export function injectPRLabelPosition(): void {
	if (!isIssueOrPRListPage()) return;

	// Old DOM (PR list / Turbo) — process once
	processOldRows();

	// New DOM (React) — CSS animation fires when trailingBadgesContainer appears.
	// Naturally handles React re-rendering: recreated elements trigger new animations.
	if (!listenerActive) {
		document.addEventListener("animationstart", (e: AnimationEvent) => {
			if (e.animationName !== "better-github-detect-labels") return;
			processTrailingBadges(e.target as HTMLElement);
		});
		listenerActive = true;
	}
}

export function cleanupPRLabelPosition(): void {
	document.querySelectorAll(`.${HIDDEN_ORIGINAL_CLASS}`).forEach((el) => {
		el.classList.remove(HIDDEN_ORIGINAL_CLASS);
	});
}
