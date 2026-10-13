// Reduced from the repository pull-requests preview DOM. Rows have neither
// issue_<number> IDs nor explicit listitem roles; labels are React buttons.
export function dashboardRow(
  number: number,
  label = "Feature",
  dom: "prefixed" | "current" = "prefixed",
): string {
  const row = `<li id="_R_${number}_-list-view-node">
    <div data-listview-item-title-container="true">
      <h3><a data-testid="listitem-title-link" href="https://github.com/owner/repo/pull/${number}">PR ${number}</a></h3>
      <span class="Title-module__trailingBadgesContainer__INeSa">
        <button type="button" tabindex="-1" aria-label="Filter by label ${label}"><span text="${label}">${label}</span></button>
      </span>
    </div>
    <div class="MainContent-module__container__uXXH2">
      <div class="MainContent-module__inner__C80co">
        <div class="Description-module__container__hpqJz">#${number} · author opened <relative-time>yesterday</relative-time></div>
      </div>
    </div>
  </li>`;
  if (dom === "prefixed") return row;
  return row
    .replace("Title-module__trailingBadgesContainer__INeSa", "trailingBadgesContainer__4AEjpg")
    .replace(
      "MainContent-module__container__uXXH2",
      "container__VGL_Vt inlineChecksMainContent__kclwVu",
    )
    .replace("MainContent-module__inner__C80co", "inner__Rm1Enx")
    .replace("Description-module__container__hpqJz", "container__W45oI6 description__mZjLFE")
    .replace(
      '<div data-listview-item-title-container="true">',
      '<div class="container__Woawlr"><div><div class="inner__BgjhSm"><span>Open</span></div></div></div><div data-listview-item-title-container="true">',
    );
}

export function dashboard(...rows: string[]): string {
  return `<react-app app-name="pull-requests"><ul role="list" data-listview-component="items-list" data-density="default">${rows.join("")}</ul></react-app>`;
}

export function repoDashboard(...rows: string[]): string {
  return `<react-app app-name="repo"><ul role="list" data-listview-component="items-list" data-density="default">${rows.join("")}</ul></react-app>`;
}
