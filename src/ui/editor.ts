import { EventEmitter } from "../utils";
import {
  injectStyleOnce,
  normalizeNewlines,
  resolveContainer,
  type ContainerTarget,
} from "./shared";

const EDITOR_STYLE_ID = "sketchmark-editor-ui";
const DEFAULT_CLEAR_VALUE = "diagram\n\nend";

const EDITOR_CSS = `
.skm-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 240px;
  background: #1c1608;
  color: #e0c898;
  border: 1px solid #3a2a12;
  border-radius: 10px;
  overflow: hidden;
  font-family: "Courier New", monospace;
}

.skm-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #12100a;
  border-bottom: 1px solid #3a2a12;
  flex-shrink: 0;
}

.skm-editor__hint {
  margin-left: auto;
  color: #9a7848;
  font-size: 11px;
}

.skm-editor__button {
  border: 1px solid #4a3520;
  background: #22190e;
  color: #dcc48a;
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.skm-editor__button:hover {
  border-color: #f0c96a;
  color: #f0c96a;
}

.skm-editor__button--primary {
  background: #c85428;
  border-color: #c85428;
  color: #fff9ef;
}

.skm-editor__button--primary:hover {
  background: #db6437;
  border-color: #db6437;
  color: #fff;
}

.skm-editor__input {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  outline: 0;
  resize: none;
  background: #1c1608;
  color: #e0c898;
  padding: 12px 14px;
  font: inherit;
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
  caret-color: #f0c96a;
}

.skm-editor__input::placeholder {
  color: #80633b;
}

.skm-editor__error {
  display: none;
  flex-shrink: 0;
  padding: 8px 12px;
  background: #280a0a;
  border-top: 1px solid #5a1818;
  color: #f07070;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.skm-editor__error.is-visible {
  display: block;
}
`;

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

function defaultFormatter(value: string): string {
  return normalizeNewlines(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

export class SketchmarkEditor {
  readonly root: HTMLDivElement;
  readonly toolbar: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;
  readonly errorElement: HTMLDivElement;

  private readonly emitter = new EventEmitter<SketchmarkEditorEvents>();
  private readonly options: SketchmarkEditorOptions;

  constructor(options: SketchmarkEditorOptions) {
    this.options = options;

    injectStyleOnce(EDITOR_STYLE_ID, EDITOR_CSS);

    const host = resolveContainer(options.container);
    host.innerHTML = "";

    this.root = document.createElement("div");
    this.root.className = "skm-editor";

    this.toolbar = document.createElement("div");
    this.toolbar.className = "skm-editor__toolbar";

    const runButton = document.createElement("button");
    runButton.type = "button";
    runButton.className = "skm-editor__button skm-editor__button--primary";
    runButton.textContent = options.runLabel ?? "Run";
    runButton.addEventListener("click", () => this.run());

    const formatButton = document.createElement("button");
    formatButton.type = "button";
    formatButton.className = "skm-editor__button";
    formatButton.textContent = options.formatLabel ?? "Format";
    formatButton.addEventListener("click", () => this.format());

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "skm-editor__button";
    clearButton.textContent = options.clearLabel ?? "Clear";
    clearButton.addEventListener("click", () => this.clear());

    const hint = document.createElement("span");
    hint.className = "skm-editor__hint";
    hint.textContent = "Ctrl+Enter";

    if (options.showRunButton !== false) this.toolbar.appendChild(runButton);
    if (options.showFormatButton) this.toolbar.appendChild(formatButton);
    if (options.showClearButton !== false) this.toolbar.appendChild(clearButton);
    this.toolbar.appendChild(hint);

    this.textarea = document.createElement("textarea");
    this.textarea.className = "skm-editor__input";
    this.textarea.spellcheck = false;
    this.textarea.placeholder = options.placeholder ?? "diagram\nbox a label=\"Hello\"\nend";
    this.textarea.value = normalizeNewlines(options.value ?? DEFAULT_CLEAR_VALUE);
    this.textarea.addEventListener("input", () => {
      const payload = { value: this.getValue(), editor: this };
      options.onChange?.(payload.value, this);
      this.emitter.emit("change", payload);
    });
    this.textarea.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        this.run();
      }
    });

    this.errorElement = document.createElement("div");
    this.errorElement.className = "skm-editor__error";

    if (options.showToolbar !== false) {
      this.root.appendChild(this.toolbar);
    }
    this.root.appendChild(this.textarea);
    this.root.appendChild(this.errorElement);
    host.appendChild(this.root);

    if (options.autoFocus) {
      this.focus();
    }
  }

  getValue(): string {
    return this.textarea.value;
  }

  setValue(value: string, emitChange = false): void {
    this.textarea.value = normalizeNewlines(value);
    if (emitChange) {
      const payload = { value: this.getValue(), editor: this };
      this.options.onChange?.(payload.value, this);
      this.emitter.emit("change", payload);
    }
  }

  focus(): void {
    this.textarea.focus();
  }

  format(): void {
    const formatter = this.options.formatter ?? defaultFormatter;
    const value = formatter(this.getValue());
    this.setValue(value, true);
    this.emitter.emit("format", { value, editor: this });
  }

  clear(): void {
    const value = this.options.clearValue ?? DEFAULT_CLEAR_VALUE;
    this.setValue(value, true);
    this.clearError();
    this.emitter.emit("clear", { value: this.getValue(), editor: this });
  }

  run(): void {
    const value = this.getValue();
    this.options.onRun?.(value, this);
    this.emitter.emit("run", { value, editor: this });
  }

  showError(message: string): void {
    this.errorElement.textContent = message;
    this.errorElement.classList.add("is-visible");
  }

  clearError(): void {
    this.errorElement.textContent = "";
    this.errorElement.classList.remove("is-visible");
  }

  on<K extends keyof SketchmarkEditorEvents>(
    event: K,
    listener: (payload: SketchmarkEditorEvents[K]) => void,
  ): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  destroy(): void {
    this.root.remove();
  }
}
