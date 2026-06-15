import { injectSniffer } from '../src/capture/inject';
import { CaptureSession } from '../src/capture/session';
import { shouldActivate } from '../src/content/activate';
import { getSettings, watchSettings } from '../src/core/settings';

export default defineContentScript({
  matches: ['*://*.max.com/*', '*://*.hbomax.com/*'],
  runAt: 'document_start',
  async main() {
    await injectSniffer('/hbo-sniffer.js');

    let session: CaptureSession | null = null;
    const sync = async () => {
      const on = shouldActivate(await getSettings(), 'hboMax');
      if (on && !session) {
        session = new CaptureSession('hboMax', () => document.querySelector('video'));
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
