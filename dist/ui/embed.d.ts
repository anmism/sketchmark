import { type ContainerTarget } from "./shared";
import type { DiagramInstance } from "../render";
import type { ASTStepItem } from "../ast/types";
import type { SVGRendererOptions } from "../renderer/svg";
type EmbedTheme = "light" | "dark";
type EmbedSize = number | string;
export interface SketchmarkEmbedOptions {
    container: ContainerTarget;
    dsl: string;
    width?: EmbedSize;
    height?: EmbedSize;
    theme?: EmbedTheme;
    showControls?: boolean;
    playStepDelay?: number;
    focusPadding?: number;
    focusDuration?: number;
    autoFocus?: boolean;
    autoFocusOnStep?: boolean;
    svgOptions?: SVGRendererOptions;
    onNodeClick?: (nodeId: string) => void;
    onRender?: (instance: DiagramInstance, embed: SketchmarkEmbed) => void;
}
export interface SketchmarkEmbedEvents extends Record<string, unknown> {
    render: {
        instance: DiagramInstance;
        embed: SketchmarkEmbed;
    };
    error: {
        error: Error;
        embed: SketchmarkEmbed;
    };
    stepchange: {
        stepIndex: number;
        step?: ASTStepItem;
        embed: SketchmarkEmbed;
    };
}
export declare class SketchmarkEmbed {
    readonly root: HTMLDivElement;
    readonly viewport: HTMLDivElement;
    readonly world: HTMLDivElement;
    readonly diagramWrap: HTMLDivElement;
    readonly errorElement: HTMLDivElement;
    readonly controlsElement: HTMLDivElement;
    readonly stepInfoElement: HTMLSpanElement;
    instance: DiagramInstance | null;
    private readonly emitter;
    private readonly options;
    private readonly btnReset;
    private readonly btnPrev;
    private readonly btnNext;
    private readonly btnPlay;
    private animUnsub;
    private playInFlight;
    private dsl;
    private theme;
    private offsetX;
    private offsetY;
    private motionFrame;
    private resizeObserver;
    constructor(options: SketchmarkEmbedOptions);
    getDsl(): string;
    setDsl(dsl: string, renderNow?: boolean): void;
    setSize(width?: EmbedSize, height?: EmbedSize): void;
    setTheme(theme: EmbedTheme): void;
    on<K extends keyof SketchmarkEmbedEvents>(event: K, listener: (payload: SketchmarkEmbedEvents[K]) => void): () => void;
    render(nextDsl?: string): DiagramInstance | null;
    play(): Promise<void>;
    nextStep(): void;
    prevStep(): void;
    resetAnimation(): void;
    exportSVG(filename?: string): void;
    exportPNG(filename?: string): Promise<void>;
    destroy(): void;
    private applySize;
    private formatSize;
    private syncControls;
    private positionViewport;
    private animateTo;
    private applyTransform;
    private getFocusTarget;
    private findTargetElement;
    private getStepTarget;
    private parseEdgeTarget;
    private splitEdgeTarget;
    private showError;
    private clearError;
    private stopMotion;
}
export {};
//# sourceMappingURL=embed.d.ts.map