// happy-dom exposes `setURL` on `window.happyDOM` under vitest's happy-dom
// environment, but it isn't part of the standard Window type. Wrap the cast
// once so tests can switch the page URL without repeating it everywhere.
export function setUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);
}
