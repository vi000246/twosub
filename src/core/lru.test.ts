import { describe, it, expect } from 'vitest';
import { Lru, cueKey } from './lru';

describe('Lru', () => {
  it('evicts the oldest entry when over capacity', () => {
    const lru = new Lru<number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3);
    expect(lru.has('a')).toBe(false);
    expect(lru.has('b')).toBe(true);
    expect(lru.has('c')).toBe(true);
  });

  it('get() refreshes recency so the touched key survives', () => {
    const lru = new Lru<number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a'); // 'a' is now most-recent
    lru.set('c', 3); // evicts 'b'
    expect(lru.has('a')).toBe(true);
    expect(lru.has('b')).toBe(false);
  });

  it('cueKey is stable and distinguishes model', () => {
    expect(cueKey('hi', 'en', 'zh', 'm')).toBe(cueKey('hi', 'en', 'zh', 'm'));
    expect(cueKey('hi', 'en', 'zh', 'm')).not.toBe(cueKey('hi', 'en', 'zh', 'm2'));
  });
});
