import { afterEach, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectTrendingLink } from "./trending-link";

afterEach(() => {
  document.body.innerHTML = "";
});

it.each(["/", "/dashboard", "/feed"])("adds Trending after Feed on %s", (path) => {
  setUrl(`https://github.com${path}`);
  document.body.innerHTML = `<aside class="feed-left-sidebar"><nav><nav-list>
    <ul class="ActionListWrap">
      <li class="ActionListItem ActionListItem--withActions" data-item-id="home">
        <a href="/dashboard">Home</a><button>Pin Home</button>
      </li>
      <li class="ActionListItem ActionListItem--withActions" data-item-id="feed">
        <a href="/feed">Feed</a><button>Pin Feed</button>
      </li>
    </ul>
  </nav-list></nav></aside>`;
  const feed = document.querySelector('[data-item-id="feed"]')!;
  const originalFeed = feed.outerHTML;

  injectTrendingLink();
  injectTrendingLink();

  expect(document.querySelectorAll(".better-github-trending-nav")).toHaveLength(1);
  expect(feed.nextElementSibling?.querySelector("a")?.getAttribute("href")).toBe("/trending");
  expect(feed.nextElementSibling?.querySelector("a")?.textContent?.trim()).toBe("Trending");
  expect(feed.outerHTML).toBe(originalFeed);
});
