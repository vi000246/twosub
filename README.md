# TwoSub

Bilingual (English / Chinese) **dual-subtitle + instant word-learning** browser extension for **Netflix, YouTube, and HBO Max**. Built with [WXT](https://wxt.dev/) — Manifest V3, Firefox + Chromium/Brave from one codebase.

English sits on top (the language you're learning); Chinese below (native track when the title has one, otherwise translated by **Gemini** with your own API key). Pause and hover/click an English word for an instant meaning + pronunciation.

> 🚧 Work in progress — **Milestone 1**: foundation + Netflix/YouTube dual subtitles + appearance customization. Word lookup (M2), HBO Max (M3), and cross-browser release (M4) follow.

## Develop

```bash
npm install
npm run dev          # Chromium / Brave (load .output/chrome-mv3 unpacked)
npm run dev:firefox  # Firefox
npm test             # unit tests (Vitest)
npm run compile      # type-check (wxt prepare && tsc --noEmit)
npm run build        # production build → .output/
```

Set your **Gemini API key** in the extension's options page. Product docs (PRD / SRS / plan) live in [`docs/`](./docs).
