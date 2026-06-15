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
    const container = v?.closest('.watch-video, #movie_player, .html5-video-player');
    return (container as HTMLElement | null) ?? v?.parentElement ?? null;
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const v = this.getVideo();
    if (!v || this.enCues.length === 0) {
      this.overlay.render(null, null);
      return;
    }
    if (v.paused !== this.lastPaused) {
      this.lastPaused = v.paused;
      this.overlay.setPaused(v.paused);
    }
    const tMs = v.currentTime * 1000;
    const enCue = activeCueAt(this.enCues, tMs);
    let zh: string | null = null;
    if (enCue) {
      if (this.needsTranslation) {
        zh = this.translated.get(enCue.id) ?? null;
        this.prefetch(tMs);
      } else {
        // Pair the native line to the English cue's time window (equivalent sentences),
        // not the raw playhead — the two tracks are segmented differently.
        const anchorMs = (enCue.startMs + enCue.endMs) / 2;
        zh = activeCueAt(this.zhCues, anchorMs)?.text ?? activeCueAt(this.zhCues, tMs)?.text ?? null;
      }
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
