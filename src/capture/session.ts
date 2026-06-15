import { CUES_EVENT, type CuesDetail } from '../sniff/events';
import { selectTracks } from './adapter';
import { activeCueAt, upcomingCues } from '../overlay/sync';
import { Overlay } from '../overlay/overlay';
import { speak as ttsSpeak } from '../overlay/tts';
import { sendMsg } from '../core/messaging';
import { getSettings, watchSettings } from '../core/settings';
import type { Cue, Platform } from '../types/cue';
import type { Settings } from '../types/settings';

const PREFETCH = 8;

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
      speak: (word) => {
        if (this.settings.lookup.ttsEnabled) ttsSpeak(word, this.settings.lookup.ttsRate);
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
    if (this.settings.appearance.position !== 'top') {
      try {
        offset = this.measureControls(player);
      } catch {
        /* ignore */
      }
    }
    if (offset !== this.lastControlsOffset) {
      this.lastControlsOffset = offset;
      this.overlay.setControlsOffset(offset);
    }
  }

  private measureControls(player: HTMLElement): number {
    let bar: Element | null = null;
    let visible = false;
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
      bar = player.querySelector('[data-testid="controls"], [class*="ControlsContainer"]');
      visible = !!bar;
    }
    if (!bar || !visible) return 0;
    const br = bar.getBoundingClientRect();
    if (br.height <= 0) return 0;
    const pr = player.getBoundingClientRect();
    return Math.min(Math.max(pr.bottom - br.top + 8, 0), pr.height * 0.4);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.getVideo();
    if (!v || this.enCues.length === 0) {
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
    if (player && ++this.frame % 10 === 0) this.updateControlsOffset(player);

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
