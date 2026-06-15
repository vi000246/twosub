import { defineConfig } from 'wxt';

// TwoSub — MV3 extension, built for Firefox + Chromium/Brave from one codebase.
// web_accessible_resources for the MAIN-world sniffers are added alongside the
// sniffer entrypoints (capture task), so this config doesn't reference files
// that don't exist yet.
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
    ],
  },
});
