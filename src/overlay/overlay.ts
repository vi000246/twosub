import type { Settings } from '../types/settings';
import { settingsToCssVars } from './style';

// Selectors for each platform's native subtitle container (hidden so only our overlay shows).
const NATIVE_HIDE_CSS: Record<string, string> = {
  netflix: '.player-timedtext { display: none !important; }',
  youtube: '.ytp-caption-window-container { display: none !important; }',
};

const BASE_CSS = `
:host { all: initial; }
.ts-container { display:flex; flex-direction:column; align-items:center; gap:2px; width:100%;
  transform: translateY(calc(-1 * var(--ts-offset-y, 0px))); }
.ts-line { max-width:90%; text-align:center; line-height:1.25;
  font-family: system-ui, sans-serif; font-size: var(--ts-font-size, 26px);
  color: var(--ts-color, #fff); background: var(--ts-bg, rgba(0,0,0,.55));
  padding: 0 .4em; border-radius: 4px; text-shadow: 0 1px 2px rgba(0,0,0,.9); }
.ts-zh { font-size: calc(var(--ts-font-size, 26px) * .82); opacity: .95; }
.ts-w { pointer-events: auto; }   /* words are interactive — used by M2 word lookup */
`;

// Shadow-DOM dual-subtitle overlay. EN line is tokenized into per-word spans so M2 can
// attach hover/click; ZH line is plain text. Native subtitles are hidden via a page-level style.
export class Overlay {
  private host: HTMLElement;
  private enEl: HTMLElement;
  private zhEl: HTMLElement;
  private hideEl: HTMLStyleElement;

  constructor(platform: string) {
    this.host = document.createElement('div');
    this.host.id = 'twosub-overlay-host';
    this.host.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none;';
    const root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = BASE_CSS;
    const container = document.createElement('div');
    container.className = 'ts-container';
    this.enEl = document.createElement('div');
    this.enEl.className = 'ts-line ts-en';
    this.zhEl = document.createElement('div');
    this.zhEl.className = 'ts-line ts-zh';
    container.append(this.enEl, this.zhEl);
    root.append(style, container);

    this.hideEl = document.createElement('style');
    this.hideEl.textContent = NATIVE_HIDE_CSS[platform] ?? '';
    document.documentElement.appendChild(this.hideEl);
  }

  mount(parent: HTMLElement): void {
    if (!this.host.isConnected) parent.appendChild(this.host);
  }

  applySettings(s: Settings): void {
    for (const [k, v] of Object.entries(settingsToCssVars(s.appearance))) {
      this.host.style.setProperty(k, v);
    }
    const top = s.languages.learningOnTop;
    this.enEl.style.order = top ? '0' : '1';
    this.zhEl.style.order = top ? '1' : '0';
    this.host.style.top = s.appearance.position === 'top' ? '0' : '';
    this.host.style.bottom = s.appearance.position === 'top' ? '' : '0';
  }

  render(en: string | null, zh: string | null): void {
    this.enEl.replaceChildren(...(en ? tokenize(en) : []));
    this.zhEl.textContent = zh ?? '';
    this.enEl.style.visibility = en ? 'visible' : 'hidden';
    this.zhEl.style.visibility = zh ? 'visible' : 'hidden';
  }

  destroy(): void {
    this.host.remove();
    this.hideEl.remove();
  }
}

// Split a line into word spans + whitespace text nodes.
function tokenize(line: string): Node[] {
  return line.split(/(\s+)/).map((p) => {
    if (p === '' || /^\s+$/.test(p)) return document.createTextNode(p);
    const span = document.createElement('span');
    span.className = 'ts-w';
    span.textContent = p;
    return span;
  });
}
