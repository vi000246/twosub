import { injectSniffer } from '../src/capture/inject';
import { CaptureSession } from '../src/capture/session';
import { shouldActivate } from '../src/content/activate';
import { getSettings, watchSettings } from '../src/core/settings';

export default defineContentScript({
  matches: ['*://*.netflix.com/*'],
  runAt: 'document_start',
  async main() {
    await injectSniffer('/netflix-sniffer.js');

    let session: CaptureSession | null = null;
    const sync = async () => {
      const on = shouldActivate(await getSettings(), 'netflix');
      if (on && !session) {
        session = new CaptureSession('netflix', () => document.querySelector('video'));
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
