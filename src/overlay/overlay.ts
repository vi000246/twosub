import type { Settings } from '../types/settings';
import type { MsgResult } from '../types/messages';
import { settingsToCssVars } from './style';

type LookupResult = MsgResult['LOOKUP_WORD'];
type DictResult = MsgResult['DICT_LOOKUP'];

export interface OverlayHandlers {
  lookup: (word: string, sentence: string) => Promise<LookupResult>;
  dict: (word: string) => Promise<DictResult>;
  speak: (word: string) => void;
}

// Selectors for each platform's native subtitle container (hidden so only our overlay shows).
const NATIVE_HIDE_CSS: Record<string, string> = {
  netflix: '.player-timedtext { display: none !important; }',
  youtube: '.ytp-caption-window-container { display: none !important; }',
};

const BASE_CSS = `
:host { all: initial; }
.ts-container { display:flex; flex-direction:column; align-items:center; gap:2px; width:100%;
  transform: translateY(calc(-1 * var(--ts-offset-y, 0px) - var(--ts-controls-offset, 0px)));
  transition: transform 0.15s ease; }
.ts-line { max-width:90%; text-align:center; line-height:1.25; min-height:1.25em;
  font-family: system-ui, sans-serif; font-size: var(--ts-font-size, 26px);
  color: var(--ts-color, #fff); background: var(--ts-bg, rgba(0,0,0,.55));
  padding: 0 .4em; border-radius: 4px; text-shadow: 0 1px 2px rgba(0,0,0,.9); }
.ts-zh { font-size: calc(var(--ts-font-size, 26px) * .82); opacity: .95; }
.ts-w { pointer-events: auto; }
.ts-container.ts-paused .ts-w:hover { background: rgba(80,140,255,.55); border-radius:3px; cursor:pointer; }
.ts-popup { position:absolute; pointer-events:auto; width:max-content; max-width:340px; max-height:50vh;
  overflow-y:auto; transform:translateX(-50%);
  background:#1e1e1e; color:#eee; border:1px solid #444; border-radius:8px; padding:10px 12px;
  font-family:system-ui, sans-serif; font-size:14px; line-height:1.45; text-align:left;
  box-shadow:0 6px 20px rgba(0,0,0,.55); }
.ts-popup[hidden]{ display:none; }
.ts-dhead{ display:flex; align-items:baseline; gap:6px; }
.ts-popup .ts-word{ font-weight:700; font-size:17px; }
.ts-popup .ts-phon{ color:#8ab; font-size:13px; }
.ts-popup .ts-mean{ margin:4px 0 2px; color:#7fdca0; font-size:15px; }
.ts-popup .ts-pos{ color:#f3a766; font-style:italic; font-size:12px; margin-top:7px; }
.ts-popup ol{ margin:2px 0 0; padding-left:18px; }
.ts-popup li{ margin:1px 0; }
.ts-popup .ts-ex{ display:block; color:#9aa; font-style:italic; font-size:12px; }
.ts-popup .ts-note{ color:#caa; }
.ts-popup .ts-speak{ pointer-events:auto; cursor:pointer; background:none; border:none;
  color:#7bf; font-size:17px; padding:0; line-height:1; }
`;

// Shadow-DOM dual-subtitle overlay. EN line is tokenized into per-word spans; when paused,
// hovering/clicking a word opens a popup with its contextual meaning + pronunciation.
export class Overlay {
  private host: HTMLElement;
  private container: HTMLElement;
  private enEl: HTMLElement;
  private zhEl: HTMLElement;
  private popup: HTMLElement;
  private hideEl: HTMLStyleElement;
  private hideCss: string;

  private active = true;
  private paused = false;
  private currentEn: string | null = null;
  private handlers?: OverlayHandlers;
  private activeWordEl: HTMLElement | null = null;
  private hoverTimer = 0;
  private hideTimer = 0;

  constructor(platform: string) {
    this.host = document.createElement('div');
    this.host.id = 'twosub-overlay-host';
    this.host.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none;';
    const root = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = BASE_CSS;
    this.container = document.createElement('div');
    this.container.className = 'ts-container';
    this.enEl = document.createElement('div');
    this.enEl.className = 'ts-line ts-en';
    this.zhEl = document.createElement('div');
    this.zhEl.className = 'ts-line ts-zh';
    this.container.append(this.enEl, this.zhEl);
    this.popup = document.createElement('div');
    this.popup.className = 'ts-popup';
    this.popup.hidden = true;
    root.append(style, this.container, this.popup);

    this.enEl.addEventListener('mouseover', this.onWordOver);
    this.enEl.addEventListener('click', this.onWordClick);
    this.enEl.addEventListener('mouseout', this.onWordOut);
    this.popup.addEventListener('mouseenter', this.cancelHide);
    this.popup.addEventListener('mouseleave', this.scheduleHide);
    // Keep word/popup pointer events from reaching the player (Netflix resumes playback on click).
    const swallow = (e: Event) => {
      if (e.currentTarget === this.popup || (e.target as HTMLElement | null)?.closest?.('.ts-w')) {
        e.stopPropagation();
      }
    };
    (['mousedown', 'pointerdown', 'click', 'dblclick'] as const).forEach((ev) => {
      this.enEl.addEventListener(ev, swallow);
      this.popup.addEventListener(ev, swallow);
    });

    // Native subtitles are hidden ONLY while we actually render an English line (see render()),
    // so if capture fails the user keeps the platform's own subtitles.
    this.hideCss = NATIVE_HIDE_CSS[platform] ?? '';
    this.hideEl = document.createElement('style');
    document.documentElement.appendChild(this.hideEl);
  }

  setHandlers(h: OverlayHandlers): void {
    this.handlers = h;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.container.classList.toggle('ts-paused', paused);
    if (!paused) this.hidePopup();
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

  setControlsOffset(px: number): void {
    this.host.style.setProperty('--ts-controls-offset', `${Math.round(px)}px`);
  }

  // Toggle off → hide our two lines and let the platform's native subtitles show.
  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.hideEl.textContent = '';
      this.enEl.style.visibility = 'hidden';
      this.zhEl.style.visibility = 'hidden';
      this.hidePopup();
    }
  }

  render(en: string | null, zh: string | null): void {
    if (!this.active) return;
    if (en !== this.currentEn) {
      this.currentEn = en;
      this.enEl.replaceChildren(...(en ? tokenize(en) : []));
      this.hidePopup(); // line changed — drop any stale popup
    }
    // Hide native subs continuously while our overlay is mounted (mounting only happens once we
    // have cues), so the platform's own subtitle never flashes through during EN cue gaps.
    this.hideEl.textContent = this.host.isConnected ? this.hideCss : '';
    this.zhEl.textContent = zh ?? '';
    this.enEl.style.visibility = en ? 'visible' : 'hidden';
    this.zhEl.style.visibility = zh ? 'visible' : 'hidden';
  }

  destroy(): void {
    clearTimeout(this.hoverTimer);
    clearTimeout(this.hideTimer);
    this.host.remove();
    this.hideEl.remove();
  }

  private onWordOver = (e: MouseEvent): void => {
    if (!this.paused) return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.ts-w');
    if (!el || el === this.activeWordEl) return;
    clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => void this.openLookup(el, false), 220);
  };

  private onWordClick = (e: MouseEvent): void => {
    if (!this.paused) return;
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('.ts-w');
    if (!el) return;
    clearTimeout(this.hoverTimer);
    void this.openLookup(el, true);
  };

  private onWordOut = (): void => {
    if (this.paused) this.scheduleHide();
  };

  private async openLookup(el: HTMLElement, speak: boolean): Promise<void> {
    this.cancelHide();
    clearTimeout(this.hoverTimer);
    const word = stripWord(el.textContent ?? '');
    if (!word) return;
    this.activeWordEl = el;
    this.positionPopup(el);
    this.popup.innerHTML =
      `<div class="ts-dhead"><button class="ts-speak" title="發音">🔊</button>` +
      `<span class="ts-word">${esc(word)}</span></div><div class="ts-note">查詢中…</div>`;
    this.popup.hidden = false;
    this.popup.scrollTop = 0;
    this.popup
      .querySelector('.ts-speak')
      ?.addEventListener('click', () => this.handlers?.speak(word));
    if (speak) this.handlers?.speak(word);
    if (!this.handlers) return;
    const h = this.handlers;
    const [meaning, dict] = await Promise.all([
      Promise.resolve(h.lookup(word, this.currentEn ?? word)).catch(() => null),
      Promise.resolve(h.dict(word)).catch(() => null),
    ]);
    if (this.activeWordEl !== el || this.popup.hidden) return; // user moved on / popup closed
    this.popup.innerHTML = dictCardHtml(word, meaning, dict);
    this.popup
      .querySelector('.ts-speak')
      ?.addEventListener('click', () => this.handlers?.speak(word));
  }

  private positionPopup(el: HTMLElement): void {
    const wr = el.getBoundingClientRect();
    const hr = this.host.getBoundingClientRect();
    this.popup.style.left = `${wr.left - hr.left + wr.width / 2}px`;
    this.popup.style.bottom = `${hr.bottom - wr.top + 8}px`;
  }

  private hidePopup = (): void => {
    this.popup.hidden = true;
    this.activeWordEl = null;
  };

  private scheduleHide = (): void => {
    this.cancelHide();
    this.hideTimer = window.setTimeout(this.hidePopup, 320);
  };

  private cancelHide = (): void => {
    clearTimeout(this.hideTimer);
  };
}

function tokenize(line: string): Node[] {
  return line.split(/(\s+)/).map((p) => {
    if (p === '' || /^\s+$/.test(p)) return document.createTextNode(p);
    const span = document.createElement('span');
    span.className = 'ts-w';
    span.textContent = p;
    return span;
  });
}

// Trim surrounding punctuation but keep intra-word apostrophes/hyphens (e.g. "I'll", "well-known").
function stripWord(raw: string): string {
  return raw.replace(/^[^\p{L}'’-]+|[^\p{L}'’-]+$/gu, '');
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function dictCardHtml(word: string, meaning: LookupResult | null, dict: DictResult | null): string {
  const phon = dict?.phonetic ? `<span class="ts-phon">${esc(dict.phonetic)}</span>` : '';
  const head =
    `<div class="ts-dhead"><button class="ts-speak" title="發音">🔊</button>` +
    `<span class="ts-word">${esc(word)}</span> ${phon}</div>`;

  const zhText = meaning && !meaning.error ? meaning.meaning : '';
  const lemma =
    meaning?.lemma && meaning.lemma.toLowerCase() !== word.toLowerCase()
      ? ` <span class="ts-phon">(${esc(meaning.lemma)})</span>`
      : '';
  const zh = zhText ? `<div class="ts-mean">${esc(zhText)}${lemma}</div>` : '';

  let defs = '';
  if (dict && dict.meanings.length) {
    defs = dict.meanings
      .map(
        (m) =>
          `<div class="ts-pos">${esc(m.pos)}</div><ol>` +
          m.defs
            .map(
              (d) =>
                `<li>${esc(d.def)}${
                  d.example ? `<span class="ts-ex">“${esc(d.example)}”</span>` : ''
                }</li>`,
            )
            .join('') +
          `</ol>`,
      )
      .join('');
  }

  if (!zh && !defs) {
    const note =
      meaning?.error === 'PROVIDER_NO_KEY'
        ? '設定 Gemini key 後可顯示中文翻譯；字典查無此字。'
        : '查無結果';
    defs = `<div class="ts-note">${esc(note)}</div>`;
  }
  return head + zh + defs;
}
