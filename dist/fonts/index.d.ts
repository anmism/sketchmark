export interface FontDef {
    family: string;
    url?: string;
    loaded?: boolean;
}
export declare const BUILTIN_FONTS: Record<string, FontDef>;
export declare const DEFAULT_FONT = "system-ui, sans-serif";
export declare function resolveFont(nameOrFamily: string): string;
export declare function loadFont(name: string): void;
export declare function registerFont(name: string, family: string, url?: string): void;
//# sourceMappingURL=index.d.ts.map