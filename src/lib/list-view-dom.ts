// GitHub now omits CSS-module name prefixes. The parent distinguishes main
// content from the status icon's separate inner__ wrapper.
export const MAIN_CONTENT_INNER_SELECTOR =
  "[class*='MainContent-module__inner'], div[class^='container__'] > div[class^='inner__']";
