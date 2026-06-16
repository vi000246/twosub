# TwoSub — Privacy Policy

_Last updated: 2026-06-16_

TwoSub is a browser extension that shows bilingual (English/Chinese) dual subtitles and
instant word lookups on Netflix, YouTube, and HBO Max. This policy explains exactly what
data the extension handles.

## Short version

- TwoSub does **not** have any backend server of its own and does **not** collect, sell, or
  transmit your data to the developer.
- It runs entirely in your browser. The only network requests it makes are to the
  third‑party services listed below, and only to provide the feature you are using.
- No analytics, no tracking, no advertising.

## What data is processed, and why

| Data | Purpose | Where it goes |
|---|---|---|
| Subtitle text of the video you are watching | To display it and (when no native translation exists) translate it | Sent to **Google Gemini** only when a translation is needed (see below) |
| A word you click/hover to look up | To fetch its meaning, phonetics, and pronunciation audio | Word meaning → **Google Gemini**; dictionary entry + audio → **dictionaryapi.dev** |
| Your settings (appearance, languages, platform toggles) and your Google Gemini API key | To run the extension | Stored **locally** in your browser (`chrome.storage.local`). Never sent anywhere except, in the case of the API key, to Google as the standard `x-goog-api-key` header when you make a translation request |

TwoSub does not access your browsing history, cookies, passwords, or any site other than
the supported video platforms and the API endpoints listed below.

## Third‑party services

When a feature requires it, TwoSub sends the minimum necessary text to:

- **Google Gemini API** (`generativelanguage.googleapis.com`) — for subtitle translation and
  contextual word meanings, authenticated with **your own** Gemini API key. Subject to
  Google's Privacy Policy and Gemini API terms.
- **Free Dictionary API** (`dictionaryapi.dev`) — for dictionary definitions and the
  British pronunciation audio of a looked‑up word. Only the single word is sent.

TwoSub reads subtitle data from the page on **Netflix**, **YouTube**, and **HBO Max** purely
to render it locally; that data is not stored or transmitted except as described above.

## Storage and retention

- Settings and your API key are stored locally on your device and remain until you change
  them or uninstall the extension.
- Translations are cached in memory only for the current session to reduce API calls; the
  cache is discarded when the tab/extension is closed.

## Your choices

- Translation/word‑lookup features only run when you supply a Gemini API key and use them.
- Uninstalling the extension removes all locally stored settings and keys.

## Contact

Questions: open an issue at https://github.com/vi000246/twosub/issues
