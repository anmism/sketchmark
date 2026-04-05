import { type ContainerTarget } from "./shared";
import type { DiagramInstance } from "../render";
import type { ASTStepItem } from "../ast/types";
import type { SVGRendererOptions } from "../renderer/svg";
import type { CanvasRendererOptions } from "../renderer/canvas";
import type { SketchmarkEditor } from "./editor";
type CanvasTheme = "light" | "dark";
export interface SketchmarkCanvasOptions {
    container: ContainerTarget;
    dsl?: string;
    renderer?: "svg" | "canvas";
    theme?: CanvasTheme;
    autoFit?: boolean;
    preserveViewOnRender?: boolean;
    fitPadding?: number;
    zoomMin?: number;
    zoomMax?: number;
    playStepDelay?: number;
    showAnimationBar?: boolean;
    showControls?: boolean;
    showMinimap?: boolean;
    svgOptions?: SVGRendererOptions;
    canvasOptions?: CanvasRendererOptions;
    onNodeClick?: (nodeId: string) => void;
    onRender?: (instance: DiagramInstance, canvas: SketchmarkCanvas) => void;
}
export interface SketchmarkCanvasViewChange {
    panX: number;
    panY: number;
    zoom: number;
    canvas: SketchmarkCanvas;
}
export interface SketchmarkCanvasEvents extends Record<string, unknown> {
    render: {
        instance: DiagramInstance;
        canvas: SketchmarkCanvas;
    };
    error: {
        error: Error;
        canvas: SketchmarkCanvas;
    };
    stepchange: {
        stepIndex: number;
        step?: ASTStepItem;
        canvas: SketchmarkCanvas;
    };
    viewchange: SketchmarkCanvasViewChange;
}
export interface SketchmarkCanvasBindEditorOptions {
    renderOnRun?: boolean;
    renderOnChange?: boolean;
    mirrorErrors?: boolean;
    initialRender?: boolean;
}
export declare class SketchmarkCanvas {
    readonly root: HTMLDivElement;
    readonly viewport: HTMLDivElement;
    readonly diagramWrap: HTMLDivElement;
    readonly errorElement: HTMLDivElement;
    readonly minimapCanvas: HTMLCanvasElement;
    instance: DiagramInstance | null;
    private readonly emitter;
    private readonly options;
    private readonly world;
    private readonly zoomLabel;
    private readonly stepDisplay;
    private readonly stepLabel;
    private readonly statsLabel;
    private readonly minimapIndicator;
    private readonly playButton;
    private readonly prevButton;
    private readonly nextButton;
    private readonly resetButton;
    private readonly gridPattern;
    private readonly gridDot;
    private readonly renderer;
    private dsl;
    private theme;
    private panX;
    private panY;
    private zoom;
    private isPanning;
    private panMoved;
    private activePointerId;
    private lastPX;
    private lastPY;
    private suppressClickUntil;
    private hasRenderedOnce;
    private playInFlight;
    private minimapToken;
    private animUnsub;
    private editorCleanup;
    private mirroredEditor;
    private readonly onPointerDown;
    private readonly onPointerMove;
    private readonly onStopPanning;
    private readonly onViewportClick;
    private readonly onWheel;
    constructor(options: SketchmarkCanvasOptions);
    getDsl(): string;
    setDsl(dsl: string, renderNow?: boolean): void;
    bindEditor(editor: SketchmarkEditor, options?: SketchmarkCanvasBindEditorOptions): () => void;
    on<K extends keyof SketchmarkCanvasEvents>(event: K, listener: (payload: SketchmarkCanvasEvents[K]) => void): () => void;
    render(nextDsl?: string): DiagramInstance | null;
    play(): Promise<void>;
    nextStep(): void;
    prevStep(): void;
    resetAnimation(): void;
    fitContent(): void;
    resetView(): void;
    setTheme(theme: CanvasTheme): void;
    destroy(): void;
    private applyTransform;
    private zoomTo;
    private syncAnimationUi;
    private getStepTarget;
    private getStepLabel;
    private focusCurrentStep;
    private findSvgElement;
    private focusAnimatedElement;
    private splitEdgeTarget;
    private getContentSize;
    private updateMinimapIndicator;
    private renderMinimapPreview;
    private showError;
    private clearError;
}
export {};
//# sourceMappingURL=canvas.d.ts.map