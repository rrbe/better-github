import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRApproveNow } from "./pr-approve-now";
import { approvePR } from "../lib/github-api";

// Replace the content<->worker bridge so approvePR is driven with canned results
// and never touches chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";
const PR_URL = `${GH}/owner/repo/pull/42`;

// Minimal DOM the module needs:
//  - a user-login meta (current viewer)
//  - the PR author line (so the "author can't approve own PR" guard can run)
//  - the reviewers <summary> trigger that the "approve now" link is appended into
function prPage(opts: { viewer?: string; author?: string } = {}): void {
  const { viewer = "reviewer", author = "someone-else" } = opts;
  document.head.innerHTML = `<meta name="user-login" content="${viewer}">`;
  document.body.innerHTML = `
    <div class="js-command-palette-pull-body">
      <a class="author" href="/${author}">${author}</a>
    </div>
    <details>
      <summary data-menu-trigger="reviewers-select-menu" class="discussion-sidebar-heading">
        Reviewers
      </summary>
    </details>
  `;
}

function approveLink(): HTMLAnchorElement | null {
  return document.querySelector<HTMLAnchorElement>(".better-github-approve-now");
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".better-github-approve-dialog-overlay");
}

// The submit handler awaits approvePR then branches; flush microtasks.
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("injectPRApproveNow", () => {
  let reload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(PR_URL);
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Spy on the real location.reload so setUrl()'s URL plumbing stays intact.
    reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    // happy-dom doesn't define window.alert; provide a spy-able stub.
    (window as unknown as { alert: () => void }).alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { alert?: () => void }).alert;
  });

  it("injects an 'approve now' link inside the reviewers summary", async () => {
    prPage();

    await injectPRApproveNow();

    const link = approveLink();
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("approve now");
    // Appended into the reviewers <summary>, not floating elsewhere.
    expect(link!.closest('summary[data-menu-trigger="reviewers-select-menu"]')).not.toBeNull();
    // Preceded by the " – " separator text node.
    expect(link!.previousSibling?.textContent).toBe(" – ");
  });

  it("does nothing when not on a PR detail page", async () => {
    setUrl(`${GH}/owner/repo/pulls`);
    prPage();

    await injectPRApproveNow();

    expect(approveLink()).toBeNull();
    expect(approvePR).not.toHaveBeenCalled();
  });

  it("does not inject when the current user is the PR author", async () => {
    // GitHub forbids self-approval, so the button must be hidden.
    prPage({ viewer: "octocat", author: "octocat" });

    await injectPRApproveNow();

    expect(approveLink()).toBeNull();
  });

  it("does not inject when there is no reviewers heading", async () => {
    prPage();
    document.querySelector("details")!.remove();

    await injectPRApproveNow();

    expect(approveLink()).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicate link", async () => {
    prPage();

    await injectPRApproveNow();
    await injectPRApproveNow();

    expect(document.querySelectorAll(".better-github-approve-now")).toHaveLength(1);
  });

  it("opens the confirm dialog on click without approving yet", async () => {
    prPage();
    await injectPRApproveNow();

    expect(dialog()).toBeNull();
    approveLink()!.click();

    // Dialog appears; nothing submitted until the user confirms.
    expect(dialog()).not.toBeNull();
    expect(document.querySelector(".better-github-approve-submit")).not.toBeNull();
    expect(approvePR).not.toHaveBeenCalled();
  });

  it("submitting the dialog calls approvePR with owner/repo/prNumber/body and reloads on success", async () => {
    vi.mocked(approvePR).mockResolvedValue({ success: true });
    prPage();
    await injectPRApproveNow();

    approveLink()!.click();
    const input = document.querySelector<HTMLInputElement>(".better-github-approve-input")!;
    input.value = "  LGTM  ";
    document.querySelector<HTMLButtonElement>(".better-github-approve-submit")!.click();
    await flush();

    // body is trimmed; ids come from the PR URL.
    expect(approvePR).toHaveBeenCalledTimes(1);
    expect(approvePR).toHaveBeenCalledWith("owner", "repo", 42, "LGTM");
    // Success closes the dialog and reloads.
    expect(dialog()).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("re-enables submit and alerts on failure, leaving the dialog open", async () => {
    vi.mocked(approvePR).mockResolvedValue({ success: false, error: "boom" });
    const alertSpy = window.alert as ReturnType<typeof vi.fn>;
    prPage();
    await injectPRApproveNow();

    approveLink()!.click();
    const submit = document.querySelector<HTMLButtonElement>(".better-github-approve-submit")!;
    submit.click();
    await flush();

    expect(approvePR).toHaveBeenCalledTimes(1);
    // Failure: dialog stays, button re-enabled and reset, error surfaced.
    expect(dialog()).not.toBeNull();
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Approve");
    expect(alertSpy).toHaveBeenCalledWith("Failed to approve PR: boom");
    expect(reload).not.toHaveBeenCalled();
  });

  it("cancel button closes the dialog without approving", async () => {
    prPage();
    await injectPRApproveNow();

    approveLink()!.click();
    document.querySelector<HTMLButtonElement>(".better-github-approve-cancel")!.click();

    expect(dialog()).toBeNull();
    expect(approvePR).not.toHaveBeenCalled();
  });
});
