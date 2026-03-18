// ============================================================
// sketchmark — Utility Helpers
// ============================================================

export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffff;
  return h;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  }) as T;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let tid: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(tid);
    tid = setTimeout(() => fn(...args), ms);
  }) as T;
}

export class EventEmitter<Events extends Record<string, unknown>> {
  private _ls = new Map<keyof Events, Set<any>>();
  on<K extends keyof Events>(event: K, fn: (data: Events[K]) => void): this {
    if (!this._ls.has(event)) this._ls.set(event, new Set());
    this._ls.get(event)!.add(fn);
    return this;
  }
  off<K extends keyof Events>(event: K, fn: any): this {
    this._ls.get(event)?.delete(fn);
    return this;
  }
  emit<K extends keyof Events>(event: K, data: Events[K]): this {
    this._ls.get(event)?.forEach(fn => fn(data));
    return this;
  }
}
