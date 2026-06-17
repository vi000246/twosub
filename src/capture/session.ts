import { CUES_EVENT, type CuesDetail } from '../sniff/events';
import { selectTracks } from './adapter';
import { activeCueAt, upcomingCues } from '../overlay/sync';
import { Overlay } from '../overlay/overlay';
import { pronounce } from '../overlay/tts';
import { sendMsg } from '../core/messaging';
import { getSettings, watchSettings } from '../core/settings';
import type { Cue, Platform } from '../types/cue';
import { effectiveAppearance, type Settings } from '../types/settings';

const PREFETCH = 8;

// In-player toggle icon: a caption speech-bubble with two lines (= dual subtitles) + a small 文/A
// glyph hint. Inline SVG (not <img>) so it renders even under Netflix/HBO's strict img-src CSP;
// stroke/fill use currentColor to match each player's control-bar colour. An ON/OFF badge (added
// in ensureToggle) shows state. Replaceable: drop a PNG in and swap innerHTML if preferred.
const TOGGLE_ICON =
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true" role="img" style="display:block">` +
  `<path d="M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 16.5H10l-4.2 3.4a.6.6 0 0 1-1-.46V16.5H5A2.5 2.5 0 0 1 2.5 14V6A2.5 2.5 0 0 1 5 3.5Z" fill="currentColor" opacity="0.18"/>` +
  `<path d="M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 16.5H10l-4.2 3.4a.6.6 0 0 1-1-.46V16.5H5A2.5 2.5 0 0 1 2.5 14V6A2.5 2.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>` +
  `<path d="M6.6 8h7.4M6.6 11.4h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>` +
  `<text x="17.4" y="12" text-anchor="middle" font-weight="800" font-size="7.5" fill="currentColor" font-family="Arial,system-ui,sans-serif">A</text>` +
  `</svg>`;

// ON/OFF state pill, bottom-right of the button (mirrors Read Frog's toggle affordance).
const TOGGLE_BADGE =
  `<span class="twosub-badge" style="position:absolute;bottom:0;right:0;font:800 8px/1 system-ui,sans-serif;` +
  `padding:1px 3px;border-radius:5px;color:#fff;letter-spacing:.04em;pointer-events:none;` +
  `box-shadow:0 0 0 1px rgba(0,0,0,.35);">OFF</span>`;

// HBO autohides its control bar by fading a PARENT's opacity while leaving the bar in the DOM.
// CSS opacity isn't inherited, so checking only the bar reads opacity:1 — walk the ancestor chain
// and treat the bar as hidden if any ancestor is faded / hidden / collapsed.
function isElementVisible(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  for (let i = 0; node && i < 8; i++) {
    const st = getComputedStyle(node);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    if (parseFloat(st.opacity || '1') <= 0.05) return false;
    node = node.parentElement;
  }
  return true;
}

// Ties a platform's sniffer output to the on-screen overlay: collects cues, decides
// native-vs-AI for the Chinese line, prefetches translations, and renders synced to playback.
export class CaptureSession {
  private overlay: Overlay;
  private enCues: Cue[] = [];
  private zhCues: Cue[] = [];
  private translated = new Map<string, string>(); // en cue id -> zh text
  private requested = new Set<string>();
  private needsTranslation = false;
  private raf = 0;
  private lastPaused = false;
  private frame = 0;
  private lastControlsOffset = -1;
  private lastVideoId = '';
  private active = true;
  private zhOnly = false;
  private toggleBtn: HTMLButtonElement | null = null;
  private stopWatch?: () => void;
  private settings!: Settings;

  private onCues = (e: Event) => this.handleCues((e as CustomEvent<CuesDetail>).detail);

  constructor(
    private platform: Platform,
    private getVideo: () => HTMLVideoElement | null,
  ) {
    this.overlay = new Overlay(platform);
  }

  async start(): Promise<void> {
    this.settings = await getSettings();
    console.log('[TwoSub] session started:', this.platform);
    this.overlay.setHandlers({
      lookup: (word, sentence) => sendMsg('LOOKUP_WORD', { word, sentence, src: 'en', tgt: 'zh' }),
      dict: (word) => sendMsg('DICT_LOOKUP', { word }),
      speak: (word, audioUrl) => {
        if (this.settings.lookup.ttsEnabled)
          pronounce(audioUrl, word, this.settings.lookup.ttsRate);
      },
    });
    window.addEventListener(CUES_EVENT, this.onCues);
    this.stopWatch = watchSettings((s) => {
      this.settings = s;
      this.overlay.applySettings(s);
    });
    this.loop();
  }

  stop(): void {
    window.removeEventListener(CUES_EVENT, this.onCues);
    this.stopWatch?.();
    cancelAnimationFrame(this.raf);
    this.toggleBtn?.remove();
    this.overlay.destroy();
  }

  private handleCues(detail: CuesDetail): void {
    if (detail.platform !== this.platform) return;
    if (detail.videoId && detail.videoId !== this.lastVideoId) {
      // New video on an SPA (YouTube) — drop the previous video's cues so they don't linger.
      this.lastVideoId = detail.videoId;
      this.enCues = [];
      this.zhCues = [];
      this.translated.clear();
      this.requested.clear();
    }
    if (detail.audioLang && this.settings.languages.foreignAudioChineseOnly) {
      // Opt-in: non-English audio → drop the English line and show only the Chinese subtitle.
      const zhOnly = !detail.audioLang.toLowerCase().startsWith('en');
      if (zhOnly !== this.zhOnly) {
        this.zhOnly = zhOnly;
        this.overlay.setZhOnly(zhOnly);
        console.log(
          `[TwoSub] audio lang=${detail.audioLang} → ${zhOnly ? 'Chinese-only' : 'dual'} subtitles`,
        );
      }
    }
    const { learning, native } = this.settings.languages;
    // Pick cues from ONE track per language (preferring a specific variant, e.g. Traditional
    // Chinese) so we never merge two differently-timed tracks into a garbled / drifting line.
    const pickByLang = (prefs: string[]): Cue[] => {
      for (const p of prefs) {
        const c = detail.cues
          .filter((x) => x.lang.toLowerCase().startsWith(p))
          .sort((a, b) => a.startMs - b.startMs);
        if (c.length) return c;
      }
      return [];
    };

    const en = pickByLang([learning]);
    if (en.length) this.enCues = en;

    const sel = selectTracks(detail.tracks, learning, native);
    this.needsTranslation = sel.needsTranslation;
    if (!sel.needsTranslation) {
      const zhPrefs =
        native === 'zh' ? ['zh-hant', 'zh-tw', 'zh-hk', 'zh', 'zh-hans', 'zh-cn'] : [native];
      const zh = pickByLang(zhPrefs);
      if (zh.length) this.zhCues = zh;
    }

    const player = this.playerEl();
    console.log(
      `[TwoSub] session(${this.platform}): received ${detail.cues.length} cues; en=${this.enCues.length} needsTranslation=${this.needsTranslation} player=${!!player}`,
    );
    if (player) this.overlay.mount(player);
    this.overlay.applySettings(this.settings);
  }

  private playerEl(): HTMLElement | null {
    const v = this.getVideo();
    if (!v) return null;
    return (
      (v.closest(
        '.watch-video, .watch-video--player-view, #movie_player, .html5-video-player, [data-uia="player"]',
      ) as HTMLElement | null) ?? v.parentElement
    );
  }

  // Keep subtitles above the player's bottom control bar while it's visible (mirrors InterSub).
  private updateControlsOffset(player: HTMLElement): void {
    let offset = 0;
    // Auto-lift above the control bar in bottom AND custom modes (custom just adds a manual offset
    // on top); only 'top' skips it, since there's no bottom bar to clear up there.
    const pos = effectiveAppearance(this.settings, this.platform).position;
    if (pos !== 'top') {
      try {
        offset = this.measureControls(player);
      } catch {
        /* ignore */
      }
    }
    if (offset !== this.lastControlsOffset) {
      this.lastControlsOffset = offset;
      this.overlay.setControlsOffset(offset);
      if (this.platform === 'hboMax') {
        console.log(`[TwoSub] hbo controls: pos=${pos} offset=${Math.round(offset)}`);
      }
    }
  }

  private measureControls(player: HTMLElement): number {
    let bar: Element | null;
    let visible: boolean;
    if (this.platform === 'youtube') {
      // YouTube toggles the `ytp-autohide` class on #movie_player to hide its controls.
      const mp = (document.querySelector('#movie_player') as HTMLElement | null) ?? player;
      bar = mp.querySelector('.ytp-chrome-bottom');
      visible = !mp.classList.contains('ytp-autohide');
    } else if (this.platform === 'netflix') {
      // Netflix removes the controls container from the DOM when hidden.
      bar = player.querySelector(
        '.watch-video--bottom-controls-container, [data-uia="controls-standard"]',
      );
      visible = !!bar;
    } else {
      // HBO Max — anchor to its real bottom-controls footer (class `ControlsFooter…`); the old
      // generic selector caught a full-height gradient → subtitles shoved ~40% up the screen. The
      // bar may live outside our mounted player element, so fall back to a document-level lookup.
      const q = (sel: string) => player.querySelector(sel) ?? document.querySelector(sel);
      bar =
        q('[class*="ControlsFooter"]') ??
        q('[class*="ControlBar"], [class*="BottomControls"]') ??
        q('[data-testid="player-ux-scrubber"]') ??
        q('.vjs-control-bar');
      visible = !!bar && isElementVisible(bar as HTMLElement);
    }
    if (!bar || !visible) return 0;
    const br = bar.getBoundingClientRect();
    if (br.height <= 0) return 0;
    const pr = player.getBoundingClientRect();
    return Math.min(Math.max(pr.bottom - br.top + 8, 0), pr.height * 0.4);
  }

  // A toggle injected into the player's native control bar: off → hide our overlay so the
  // platform's own subtitles show.
  private ensureToggle(player: HTMLElement): void {
    if (!this.toggleBtn) {
      const b = document.createElement('button');
      b.className = 'twosub-toggle ytp-button';
      b.innerHTML = TOGGLE_ICON + TOGGLE_BADGE;
      b.style.cssText =
        'position:relative;cursor:pointer;background:transparent;border:none;color:#fff;' +
        'display:inline-flex;align-items:center;justify-content:center;height:100%;padding:0 8px;' +
        'flex:0 0 auto;box-sizing:border-box;vertical-align:top;';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleActive();
      });
      this.toggleBtn = b;
      this.updateToggle();
    }
    this.placeToggle(this.toggleBtn, player);
  }

  private placeToggle(btn: HTMLButtonElement, player: HTMLElement): void {
    if (this.platform === 'youtube') {
      const bar = document.querySelector<HTMLElement>(
        '#movie_player .ytp-right-controls-left, #movie_player .ytp-right-controls',
      );
      if (bar && btn.parentElement !== bar) bar.prepend(btn);
      return;
    }
    if (this.platform === 'netflix') {
      // Each Netflix control button lives in its OWN slot <div class="medium …"> inside the flex
      // row. Insert before that SLOT (a sibling control to the left) — inserting INSIDE the slot,
      // next to the button, overlaps them. Anchor to the native subtitle button (fallback: speed).
      const sub =
        player.querySelector<HTMLElement>('[data-uia="control-audio-subtitle"]') ??
        player.querySelector<HTMLElement>('[data-uia="control-speed"]');
      const slot = sub?.parentElement;
      const row = slot?.parentElement;
      if (slot && row) {
        if (btn.parentElement !== row || btn.nextElementSibling !== slot) {
          row.insertBefore(btn, slot);
        }
        return;
      }
      // Fallback: append to the right end of the controls container.
      const c = player.querySelector<HTMLElement>('.watch-video--bottom-controls-container');
      if (c && btn.parentElement !== c) c.append(btn);
      return;
    }
    if (this.platform === 'hboMax') {
      // Place just to the LEFT of the volume control in HBO's bottom-right cluster.
      const anchor =
        document.querySelector('[data-testid="volume-container"]') ??
        document.querySelector('[data-testid="player-ux-volume-button"]');
      if (anchor?.parentElement && btn.parentElement !== anchor.parentElement) {
        anchor.parentElement.insertBefore(btn, anchor);
      }
    }
  }

  private toggleActive(): void {
    this.active = !this.active;
    this.overlay.setActive(this.active);
    this.updateToggle();
  }

  private updateToggle(): void {
    if (!this.toggleBtn) return;
    const on = this.active;
    const icon = this.toggleBtn.querySelector('svg');
    if (icon) (icon as SVGElement).style.opacity = on ? '1' : '0.55';
    const badge = this.toggleBtn.querySelector('.twosub-badge');
    if (badge instanceof HTMLElement) {
      badge.textContent = on ? 'ON' : 'OFF';
      badge.style.background = on ? '#22c55e' : 'rgba(110,110,110,.95)';
    }
    this.toggleBtn.setAttribute('aria-pressed', String(on));
    this.toggleBtn.title = on
      ? 'TwoSub 雙字幕：開（點擊關閉，改用原生字幕）'
      : 'TwoSub 雙字幕：關（點擊開啟）';
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.getVideo();
    // Render whenever we have EITHER line: English drives dual subtitles, but a title may expose
    // only a native (e.g. Chinese) track — then we show that single line rather than nothing.
    const haveCues = this.enCues.length > 0 || this.zhCues.length > 0;
    if (!v || !haveCues) {
      this.overlay.render(null, null);
      return;
    }
    // Mount every frame until the player is available (manifest is captured before <video> exists).
    const player = this.playerEl();
    if (player) this.overlay.mount(player);
    if (v.paused !== this.lastPaused) {
      this.lastPaused = v.paused;
      this.overlay.setPaused(v.paused);
    }
    if (player && ++this.frame % 10 === 0) {
      // Freeze the subtitle position while the lookup popup is open, so the controls
      // auto-hiding doesn't shift the word out from under the cursor and dismiss it.
      if (!this.overlay.isPopupOpen()) this.updateControlsOffset(player);
      this.ensureToggle(player);
    }
    if (!this.active) return; // toggled off in the player → native subtitles show, render nothing

    const tMs = v.currentTime * 1000;
    const enCue = activeCueAt(this.enCues, tMs);
    let zh: string | null = null;
    if (this.needsTranslation) {
      if (enCue) {
        zh = this.translated.get(enCue.id) ?? null;
        this.prefetch(tMs);
      }
    } else {
      // Native track: render the ZH cue at its OWN time so a long Chinese line stays visible
      // across several shorter English cues (disappears only when the ZH cue itself ends).
      zh = activeCueAt(this.zhCues, tMs)?.text ?? null;
    }
    this.overlay.render(enCue?.text ?? null, zh);
  };

  private prefetch(tMs: number): void {
    const upcoming = upcomingCues(this.enCues, tMs, PREFETCH).filter(
      (c) => !this.requested.has(c.id) && !this.translated.has(c.id),
    );
    if (upcoming.length === 0) return;
    upcoming.forEach((c) => this.requested.add(c.id));
    sendMsg('TRANSLATE_CUES', {
      cues: upcoming.map((c) => ({ id: c.id, text: c.text })),
      src: 'en',
      tgt: 'zh',
    })
      .then((res) => {
        if (res.error) {
          console.warn('[TwoSub] translate error:', res.error);
          upcoming.forEach((c) => this.requested.delete(c.id)); // allow retry on rate-limit/error
          return;
        }
        for (const t of res.translations) if (t.text) this.translated.set(t.id, t.text);
      })
      .catch(() => upcoming.forEach((c) => this.requested.delete(c.id)));
  }
}
