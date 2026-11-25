import { afterEach, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { cleanupPRFileTreeDiffStats, injectPRFileTreeDiffStats } from "./pr-file-tree-diff-stats";

const badge = ".better-github-file-tree-diff-stats";
const path = "/owner/repo/pull/42/changes";

afterEach(() => {
  cleanupPRFileTreeDiffStats();
  document.body.replaceChildren();
});

it.each([
  [path, "pullRequestsChangesRoute"],
  [path + "/abc", "pullRequestsChangesWithRangeRoute"],
])("totals nested files independently of the rendered diff on %s", (view, route) => {
  setUrl("https://github.com" + view);
  const data = {
    payload: {
      [route]: {
        diffSummaries: [
          { path: "src/lib/generated/client/deep/a.ts", linesAdded: 4, linesDeleted: 1 },
          { path: "src/b.ts", linesAdded: 6, linesDeleted: 2 },
          { path: "src2/b.ts", linesAdded: 80, linesDeleted: 20 },
        ],
      },
    },
  };
  const label = '<div><span class="TreeViewItemContentText"><span>name</span></span></div>';
  document.body.innerHTML = `<main><react-app initial-path="${view}">
    <script data-target="react-app.embeddedData" type="application/json">${JSON.stringify(data)}</script>
    <ul id="pr-file-tree"><li role="treeitem" aria-level="1" aria-expanded="false" id="src">${label}</li></ul>
    </react-app></main>`;
  injectPRFileTreeDiffStats();
  const folder = document.getElementById("src")!;
  expect(folder.querySelector(badge)?.textContent).toBe("+10−3");
  folder.setAttribute("aria-expanded", "true");
  folder.insertAdjacentHTML(
    "beforeend",
    `<ul><li role="treeitem" aria-level="2" id="src/lib" aria-expanded="true">${label}
      <ul><li role="treeitem" aria-level="3" id="src/lib/generated/client" aria-expanded="true">${label}
        <ul><li role="treeitem" aria-level="4" id="src/lib/generated/client/deep" aria-expanded="true">${label}
          <ul><li role="treeitem" aria-level="5" id="src/lib/generated/client/deep/a.ts">${label}</li></ul>
        </li></ul>
      </li></ul>
    </li></ul>`,
  );
  injectPRFileTreeDiffStats();
  expect([...folder.querySelectorAll(badge)].map((el) => el.textContent)).toEqual([
    "+10−3",
    "+4−1",
    "+4−1",
  ]);
  expect(document.getElementById("src/lib/generated/client/deep")!.querySelector(badge)).toBeNull();
  expect(
    document.getElementById("src/lib/generated/client/deep/a.ts")!.querySelector(badge),
  ).toBeNull();
});

it("shows a classic folder total only when all its file headers are available", () => {
  setUrl("https://github.com/owner/repo/pull/42/files");
  const header = (id: string) => `<div class="js-file-header" data-anchor="diff-${id}">
    <div class="file-info"><span class="sr-only">2 additions &amp; 1 deletion</span></div></div>`;
  document.body.innerHTML = `<main><file-tree><ul><li aria-level="3" data-tree-entry-type="directory">
    <button class="ActionList-content" aria-expanded="false">src/lib</button>
    <ul><li aria-level="4" data-tree-entry-type="directory"><button class="ActionList-content">deep</button>
    <ul>${["a", "b"].map((id) => `<li data-tree-entry-type="file"><a href="#diff-${id}">${id}</a></li>`).join("")}</ul>
    </li></ul></li></ul></file-tree>${header("a")}</main>`;
  injectPRFileTreeDiffStats();
  expect(document.querySelector(badge)).toBeNull();
  document.querySelector("main")!.insertAdjacentHTML("beforeend", header("b"));
  injectPRFileTreeDiffStats();
  expect(document.querySelector(`button > ${badge}`)?.textContent).toBe("+4−2");
  expect(document.querySelectorAll(badge)).toHaveLength(1);
  expect(document.querySelector(`a ${badge}`)).toBeNull();
});
