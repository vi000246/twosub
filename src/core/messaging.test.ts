import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { sendMsg } from './messaging';

describe('messaging', () => {
  beforeEach(() => fakeBrowser.reset());

  it('wraps the payload in the v1 envelope', async () => {
    const spy = vi
      .spyOn(fakeBrowser.runtime, 'sendMessage')
      .mockResolvedValue({ translations: [] } as never);
    await sendMsg('TRANSLATE_CUES', { cues: [{ id: '1', text: 'hi' }], src: 'en', tgt: 'zh' });
    expect(spy).toHaveBeenCalledWith({
      v: 1,
      type: 'TRANSLATE_CUES',
      payload: { cues: [{ id: '1', text: 'hi' }], src: 'en', tgt: 'zh' },
    });
  });
});
