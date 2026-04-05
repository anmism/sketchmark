import { type ContainerTarget } from "./shared";
export interface SketchmarkEditorOptions {
    container: ContainerTarget;
    value?: string;
    placeholder?: string;
    autoFocus?: boolean;
    showToolbar?: boolean;
    showRunButton?: boolean;
    showFormatButton?: boolean;
    showClearButton?: boolean;
    runLabel?: string;
    formatLabel?: string;
    clearLabel?: string;
    clearValue?: string;
    formatter?: (value: string) => string;
    onChange?: (value: string, editor: SketchmarkEditor) => void;
    onRun?: (value: string, editor: SketchmarkEditor) => void;
}
export interface SketchmarkEditorEventPayload {
    value: string;
    editor: SketchmarkEditor;
}
export interface SketchmarkEditorEvents extends Record<string, unknown> {
    change: SketchmarkEditorEventPayload;
    run: SketchmarkEditorEventPayload;
    clear: SketchmarkEditorEventPayload;
    format: SketchmarkEditorEventPayload;
}
export declare class SketchmarkEditor {
    readonly root: HTMLDivElement;
    readonly toolbar: HTMLDivElement;
    readonly textarea: HTMLTextAreaElement;
    readonly errorElement: HTMLDivElement;
    private readonly emitter;
    private readonly options;
    constructor(options: SketchmarkEditorOptions);
    getValue(): string;
    setValue(value: string, emitChange?: boolean): void;
    focus(): void;
    format(): void;
    clear(): void;
    run(): void;
    showError(message: string): void;
    clearError(): void;
    on<K extends keyof SketchmarkEditorEvents>(event: K, listener: (payload: SketchmarkEditorEvents[K]) => void): () => void;
    destroy(): void;
}
//# sourceMappingURL=editor.d.ts.map