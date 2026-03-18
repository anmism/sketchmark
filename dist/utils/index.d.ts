export declare function hashStr(s: string): number;
export declare function clamp(v: number, min: number, max: number): number;
export declare function lerp(a: number, b: number, t: number): number;
export declare function parseHex(hex: string): [number, number, number] | null;
export declare const sleep: (ms: number) => Promise<void>;
export declare function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T;
export declare function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T;
export declare class EventEmitter<Events extends Record<string, unknown>> {
    private _ls;
    on<K extends keyof Events>(event: K, fn: (data: Events[K]) => void): this;
    off<K extends keyof Events>(event: K, fn: any): this;
    emit<K extends keyof Events>(event: K, data: Events[K]): this;
}
//# sourceMappingURL=index.d.ts.map