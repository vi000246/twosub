import type { Cue } from '../../types/cue';
import { cleanText, hash } from './webvtt';

// Parse TTML / DFXP into normalized cues. In the browser we use DOMParser (handles XML
// namespaces like Netflix's `<tt xmlns:tt=...>` + tick/frame timing); in Node (tests) we fall
// back to a regex parser that covers the simple `<p begin end>` shape.
export function parseTtml(raw: string, lang: string): Cue[] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const cues = parseTtmlDom(raw, lang);
      if (cues.length) return cues;
    } catch {
      /* fall through to regex */
    }
  }
  return parseTtmlRegex(raw, lang);
}

const TTP_NS = 'http://www.w3.org/ns/ttml#parameter';

function parseTtmlDom(raw: string, lang: string): Cue[] {
  const doc = new DOMParser().parseFromString(raw, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('xml parse error');
  const root = doc.documentElement;
  const tickRate = num(root.getAttribute('ttp:tickRate') ?? root.getAttributeNS(TTP_NS, 'tickRate'));
  const frameRate = num(root.getAttribute('ttp:frameRate') ?? root.getAttributeNS(TTP_NS, 'frameRate'));

  const cues: Cue[] = [];
  const ps = doc.getElementsByTagNameNS('*', 'p'); // match <p> in any namespace
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const startMs = timeToMs(p.getAttribute('begin'), tickRate, frameRate);
    const endMs = timeToMs(p.getAttribute('end'), tickRate, frameRate);
    if (startMs == null || endMs == null) continue;
    const text = cleanText(textOf(p));
    if (!text) continue;
    cues.push({ id: hash(`${startMs}|${text}`), startMs, endMs, text, lang });
  }
  return cues;
}

// Element text with <br> rendered as a space (TTML cues are often multi-line).
function textOf(node: Element): string {
  let s = '';
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) s += c.nodeValue ?? '';
    else if (c.nodeType === 1) {
      const el = c as Element;
      s += el.localName === 'br' ? ' ' : textOf(el);
    }
  });
  return s;
}

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Handles ticks ("123t"), frames (HH:MM:SS:FF), clock (HH:MM:SS(.ms)), and offset (Ns/Nms/Nm/Nh).
export function timeToMs(t: string | null, tickRate = 0, frameRate = 0): number | null {
  if (!t) return null;
  let m = t.match(/^([\d.]+)t$/);
  if (m && tickRate) return (parseFloat(m[1]) / tickRate) * 1000;
  m = t.match(/^(\d+):(\d{2}):(\d{2}):(\d{2,})$/);
  if (m) {
    const frames = frameRate ? (Number(m[4]) / frameRate) * 1000 : 0;
    return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + frames;
  }
  m = t.match(/^(\d+):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (m) {
    const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
    return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + ms;
  }
  m = t.match(/^([\d.]+)(h|ms|m|s)$/);
  if (m) {
    const n = parseFloat(m[1]);
    return m[2] === 'h' ? n * 3_600_000 : m[2] === 'm' ? n * 60_000 : m[2] === 's' ? n * 1000 : n;
  }
  return null;
}

// Backwards-compatible alias (used by tests).
export const ttmlToMs = (t: string | undefined): number | null => timeToMs(t ?? null);

// Regex fallback (node/tests): simple `<p begin=... end=...>text</p>`.
function parseTtmlRegex(raw: string, lang: string): Cue[] {
  const cues: Cue[] = [];
  const pRe = /<(?:\w+:)?p\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(raw))) {
    const startMs = timeToMs(attr(m[1], 'begin'));
    const endMs = timeToMs(attr(m[1], 'end'));
    if (startMs == null || endMs == null) continue;
    const text = cleanText(m[2].replace(/<br\s*\/?>/gi, ' '));
    if (!text) continue;
    cues.push({ id: hash(`${startMs}|${text}`), startMs, endMs, text, lang });
  }
  return cues;
}

function attr(attrs: string, name: string): string | null {
  return attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))?.[1] ?? null;
}
