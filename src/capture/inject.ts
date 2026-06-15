import { injectScript } from 'wxt/utils/inject-script';

// Run a built unlisted sniffer script in the page's MAIN world (so it can patch the
// player's fetch/XHR/JSON). `path` is one of WXT's generated web-accessible script paths.
export function injectSniffer(path: Parameters<typeof injectScript>[0]) {
  return injectScript(path, { keepInDom: true });
}
