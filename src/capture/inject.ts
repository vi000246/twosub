import { injectScript } from 'wxt/utils/inject-script';

// Run a built unlisted sniffer script in the page's MAIN world (so it can patch the
// player's fetch/XHR/JSON). The script must be listed in web_accessible_resources.
export function injectSniffer(path: `/${string}.js`): Promise<void> {
  return injectScript(path, { keepInDom: true });
}
