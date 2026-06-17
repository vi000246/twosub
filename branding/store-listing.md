# TwoSub — Store Listing Copy

Ready-to-paste content for the Chrome Web Store and Firefox AMO. Privacy policy URL:
`https://github.com/vi000246/twosub/blob/main/PRIVACY.md`

---

## Name

- Short name: `TwoSub`
- Full listing title: `TwoSub – Dual Subtitles for Netflix, YouTube & HBO Max`

## Summary / tagline (≤132 chars)

- EN: `Bilingual English/Chinese dual subtitles + instant word lookup for Netflix, YouTube & HBO Max. Learn a language while you watch.`
- ZH: `Netflix／YouTube／HBO Max 雙語（中英）字幕＋即點即查單字與發音，邊看劇邊學英文。`

## Category

- Chrome Web Store: **Education** (alt: Tools)
- Firefox AMO: **Other** / language tools

---

## Detailed description — English

TwoSub adds bilingual (English + Traditional Chinese) dual subtitles to Netflix, YouTube, and HBO Max, so you can enjoy a show and learn a language at the same time.

KEY FEATURES
• Dual subtitles — the original English and a Chinese line together, synced to playback.
• Instant word lookup — pause and click any English word for its meaning, phonetics, definitions, and British pronunciation audio.
• Works on Netflix, YouTube, and HBO Max.
• No setup for most videos — uses the platform's own subtitle tracks when available, and YouTube's free auto-translate for the second language.
• Per-platform appearance — font, size, position, background, and color, adjustable for each platform independently.
• In-player toggle — switch the dual subtitles on/off right from the video's control bar.
• British female pronunciation for word audio.

HOW IT WORKS
TwoSub reads the subtitle data the player already loads and renders a clean overlay. For AI translation and contextual word meanings, add your own free Google Gemini API key in the options page (optional — core dual-subtitle features work without it).

PRIVACY
TwoSub has no server of its own and does not track you. Your settings and API key stay in your browser. Subtitle text and looked-up words are sent only to Google Gemini (with your own key) and the Free Dictionary API, only when needed.
Full policy: https://github.com/vi000246/twosub/blob/main/PRIVACY.md

---

## Detailed description — 繁體中文

TwoSub 在 Netflix、YouTube、HBO Max 上加上中英雙語字幕，讓你一邊追劇一邊學語言。

主要功能
• 雙語字幕 — 原文英文與中文翻譯同時顯示，與影片精準同步。
• 即點即查 — 暫停後點任一英文單字，立即看到中文意思、音標、字典釋義與英式發音。
• 支援 Netflix、YouTube、HBO Max。
• 多數影片免設定 — 優先使用平台原生字幕軌；YouTube 則用其免費自動翻譯產生第二語言。
• 各平台獨立外觀 — 字體、大小、位置、背景、顏色都能針對每個平台分別調整。
• 播放列開關 — 直接在影片控制列開／關雙語字幕。
• 單字發音採英式女聲。

運作方式
TwoSub 讀取播放器已載入的字幕資料並渲染成乾淨的雙語字幕。若想要 AI 翻譯與情境化的單字解釋，可在設定頁填入你自己的免費 Google Gemini API 金鑰（選用 — 核心雙語字幕功能不需金鑰）。

隱私
TwoSub 沒有自己的伺服器，也不追蹤你。設定與金鑰只存在你的瀏覽器；字幕文字與查詢的單字只會在需要時送到 Google Gemini（用你自己的金鑰）與 Free Dictionary API。
完整政策：https://github.com/vi000246/twosub/blob/main/PRIVACY.md

---

## Single purpose (Chrome requires this)

TwoSub displays bilingual dual subtitles and provides instant, in‑context word definitions and pronunciation on Netflix, YouTube, and HBO Max, to help users learn a language while watching video.

## Permission justifications (Chrome "Privacy practices" tab)

- **storage** — Save the user's preferences (subtitle appearance, languages, per‑platform settings) and their optional Google Gemini API key locally, so the extension remembers them across sessions.
- **Host permission — `*://*.netflix.com/*`, `*://*.youtube.com/*`, `*://*.max.com/*`, `*://*.hbomax.com/*`** — These are the supported video platforms. The extension must run on these pages to read the video's subtitle/caption data and render the dual‑subtitle overlay and word‑lookup popup. It runs on no other websites.
- **Host permission — `https://generativelanguage.googleapis.com/*`** — To send subtitle text and the word the user clicks to Google's Gemini API, using the user's own API key, for translation and contextual word meanings.
- **Host permission — `https://api.dictionaryapi.dev/*`** — To fetch dictionary definitions and the British pronunciation audio for a word the user looks up.
- **Remote code** — No. All code ships inside the package; the extension does not load or execute remote code.

## Data disclosures (Chrome "Data" section)

- Data handled: **Website content** — the subtitle text of the video being watched and words the user chooses to look up (sent to Gemini / the dictionary API to provide translation, definitions, and audio).
- NOT collected: personally identifiable info, health, financial, location, authentication info, personal communications, or web browsing history.
- Certify: data is **not** sold to third parties; **not** used or transferred for purposes unrelated to the single purpose; **not** used to determine creditworthiness or for lending.
