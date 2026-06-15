import { injectSniffer } from '../src/capture/inject';
import { CaptureSession } from '../src/capture/session';
import { shouldActivate } from '../src/content/activate';
import { getSettings, watchSettings } from '../src/core/settings';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  async main() {
    console.log('[TwoSub] youtube content script loaded');
    await injectSniffer('/youtube-sniffer.js');

    let session: CaptureSession | null = null;
    const sync = async () => {
      const on = shouldActivate(await getSettings(), 'youtube');
      if (on && !session) {
        session = new CaptureSession('youtube', () => document.querySelector('video'));
        await session.start();
      } else if (!on && session) {
        session.stop();
        session = null;
      }
    };

    await sync();
    watchSettings(() => void sync());
  },
});
