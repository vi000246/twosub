import { defineConfig } from 'wxt';

// TwoSub — MV3 extension, built for Firefox + Chromium/Brave from one codebase.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TwoSub',
    description:
      'Bilingual (English/Chinese) dual subtitles + instant word learning for Netflix, YouTube, HBO Max.',
    permissions: ['storage'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      '*://*.netflix.com/*',
      '*://*.youtube.com/*',
      '*://*.max.com/*',
      '*://*.hbomax.com/*',
    ],
    // MAIN-world sniffers, injected by the content scripts.
    web_accessible_resources: [
      {
        resources: ['netflix-sniffer.js', 'youtube-sniffer.js'],
        matches: ['*://*.netflix.com/*', '*://*.youtube.com/*'],
      },
      {
        resources: ['hbo-sniffer.js'],
        matches: ['*://*.max.com/*', '*://*.hbomax.com/*'],
      },
    ],
  },
});
