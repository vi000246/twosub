import { describe, it, expect } from 'vitest';
import { settingsToCssVars } from './style';

describe('settingsToCssVars', () => {
  it('maps appearance to CSS variables', () => {
    expect(
      settingsToCssVars({
        fontSizePx: 30,
        bgOpacity: 0.5,
        textColor: '#fff',
        position: 'bottom',
        offsetY: 12,
      }),
    ).toMatchObject({
      '--ts-font-size': '30px',
      '--ts-bg': 'rgba(0, 0, 0, 0.5)',
      '--ts-color': '#fff',
      '--ts-offset-y': '0px', // offsetY ignored unless position = custom
    });
  });

  it('applies offsetY only for custom position and clamps opacity', () => {
    const v = settingsToCssVars({
      fontSizePx: 20,
      bgOpacity: 2,
      textColor: '#000',
      position: 'custom',
      offsetY: 40,
    });
    expect(v['--ts-offset-y']).toBe('40px');
    expect(v['--ts-bg']).toBe('rgba(0, 0, 0, 1)');
  });
});
