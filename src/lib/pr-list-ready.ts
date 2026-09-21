import { PR_DASHBOARD_SELECTOR } from "./pr-list-dom";
import { isIssueOrPRListPage } from "./page-detect";

const READY_TIMEOUT = 5000;
const LIST_APP_SELECTOR = `${PR_DASHBOARD_SELECTOR}, react-app[app-name="issues-react"]`;
const watching = new WeakSet<Element>();
const timedOut = new WeakSet<Element>();

export function isPRListReady(row: Element): boolean {
  if (!isIssueOrPRListPage()) return true;
  const app = row.closest(LIST_APP_SELECTOR);
  // GitHub adds loaded after React's first commit. Classic lists and apps
  // without server-rendered content do not need the hydration gate.
  return (
    !app ||
    app.getAttribute("data-ssr") !== "true" ||
    app.classList.contains("loaded") ||
    timedOut.has(app)
  );
}

export function watchPRListReady(onReady: () => void): void {
  for (const app of document.querySelectorAll(LIST_APP_SELECTOR)) {
    if (isPRListReady(app) || watching.has(app)) continue;
    watching.add(app);
    const finish = () => {
      observer.disconnect();
      clearTimeout(timer);
      if (app.isConnected) onReady();
    };
    const observer = new MutationObserver(() => {
      if (app.classList.contains("loaded")) finish();
    });
    const timer = setTimeout(() => {
      timedOut.add(app);
      finish();
    }, READY_TIMEOUT);
    observer.observe(app, { attributes: true, attributeFilter: ["class"] });
  }
}
