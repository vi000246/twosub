// Bounded, insertion-order LRU. get() refreshes recency; set() evicts the oldest past `max`.
export class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max = 2000) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }
}

// Stable cache key for a translated line.
export function cueKey(text: string, src: string, tgt: string, model: string): string {
  return `${src}>${tgt}|${model}|${text}`;
}
