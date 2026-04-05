import { EventEmitter } from "../utils";
import { KEYWORDS } from "../parser/tokenizer";
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

.skm-editor__surface {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #1c1608;
  overflow: hidden;
}

.skm-editor__highlight,
.skm-editor__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  font: inherit;
  font-size: 12px;
  line-height: 1.7;
  tab-size: 2;
  white-space: pre-wrap;
  overflow: auto;
}

.skm-editor__highlight {
  margin: 0;
  border: 0;
  background: #1c1608;
  color: #e0c898;
  pointer-events: none;
  word-break: break-word;
}

.skm-editor__input {
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: transparent;
  caret-color: #f0c96a;
}

.skm-editor__input::placeholder {
  color: #80633b;
}

.skm-editor__input::selection {
  background: rgba(240, 201, 106, 0.22);
}

.skm-editor__token--keyword {
  color: #e07040;
}

.skm-editor__token--property {
  color: #70a8d0;
}

.skm-editor__token--string {
  color: #8db870;
}

.skm-editor__token--number {
  color: #d4a020;
}

.skm-editor__token--comment {
  color: #6a5a3a;
}

.skm-editor__token--connector {
  color: #c8b070;
}

.skm-editor__token--color {
  color: var(--skm-editor-color, #f0c96a);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  font-weight: 600;
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

const CONNECTORS = ["<-->", "<->", "-->", "<--", "---", "--", "->", "<-"];
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

function defaultFormatter(value: string): string {
  return normalizeNewlines(value)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapToken(kind: string, value: string): string {
  return `<span class="skm-editor__token skm-editor__token--${kind}">${escapeHtml(value)}</span>`;
}

function renderColorLiteral(value: string): string {
  return `<span class="skm-editor__token skm-editor__token--color" style="--skm-editor-color:${value}">${escapeHtml(value)}</span>`;
}

function renderStringToken(value: string): string {
  HEX_COLOR_RE.lastIndex = 0;
  if (!HEX_COLOR_RE.test(value)) {
    return wrapToken("string", value);
  }

  HEX_COLOR_RE.lastIndex = 0;
  let html = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = HEX_COLOR_RE.exec(value))) {
    if (match.index > lastIndex) {
      html += wrapToken("string", value.slice(lastIndex, match.index));
    }
    html += renderColorLiteral(match[0]);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    html += wrapToken("string", value.slice(lastIndex));
  }

  return html;
}

function renderPlainToken(value: string, nextChar: string): string {
  if (/^-?\d/.test(value)) {
    return wrapToken("number", value);
  }
  if (nextChar === "=") {
    return wrapToken("property", value);
  }
  if (KEYWORDS.has(value)) {
    return wrapToken("keyword", value);
  }
  return escapeHtml(value);
}

function highlightLine(line: string): string {
  let html = "";
  let index = 0;

  while (index < line.length) {
    const rest = line.slice(index);

    if (rest.startsWith("//") || rest.startsWith("#")) {
      html += wrapToken("comment", rest);
      break;
    }

    if (line[index] === "\"") {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === "\"" && line[end - 1] !== "\\") {
          end += 1;
          break;
        }
        end += 1;
      }
      html += renderStringToken(line.slice(index, end));
      index = end;
      continue;
    }

    const connector = CONNECTORS.find((candidate) => line.startsWith(candidate, index));
    if (connector) {
      html += wrapToken("connector", connector);
      index += connector.length;
      continue;
    }

    const wordMatch = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(rest);
    if (wordMatch) {
      const word = wordMatch[0];
      const nextChar = line[index + word.length] ?? "";
      html += renderPlainToken(word, nextChar);
      index += word.length;
      continue;
    }

    const numberMatch = /^-?\d+(?:\.\d+)?/.exec(rest);
    if (numberMatch) {
      html += wrapToken("number", numberMatch[0]);
      index += numberMatch[0].length;
      continue;
    }

    html += escapeHtml(line[index]);
    index += 1;
  }

  return html;
}

function renderHighlightedValue(value: string): string {
  const normalized = normalizeNewlines(value);
  const html = normalized.split("\n").map(highlightLine).join("\n");
  return html || " ";
}

export class SketchmarkEditor {
  readonly root: HTMLDivElement;
  readonly toolbar: HTMLDivElement;
  readonly surface: HTMLDivElement;
  readonly highlightElement: HTMLPreElement;
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

    this.surface = document.createElement("div");
    this.surface.className = "skm-editor__surface";

    this.highlightElement = document.createElement("pre");
    this.highlightElement.className = "skm-editor__highlight";
    this.highlightElement.setAttribute("aria-hidden", "true");

    this.textarea = document.createElement("textarea");
    this.textarea.className = "skm-editor__input";
    this.textarea.spellcheck = false;
    this.textarea.placeholder = options.placeholder ?? "diagram\nbox a label=\"Hello\"\nend";
    this.textarea.value = normalizeNewlines(options.value ?? DEFAULT_CLEAR_VALUE);
    this.textarea.addEventListener("input", () => {
      this.syncHighlight();
      const payload = { value: this.getValue(), editor: this };
      options.onChange?.(payload.value, this);
      this.emitter.emit("change", payload);
    });
    this.textarea.addEventListener("scroll", () => this.syncScroll());
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
    this.surface.appendChild(this.highlightElement);
    this.surface.appendChild(this.textarea);
    this.root.appendChild(this.surface);
    this.root.appendChild(this.errorElement);
    host.appendChild(this.root);

    this.syncHighlight();

    if (options.autoFocus) {
      this.focus();
    }
  }

  getValue(): string {
    return this.textarea.value;
  }

  setValue(value: string, emitChange = false): void {
    this.textarea.value = normalizeNewlines(value);
    this.syncHighlight();
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

  private syncHighlight(): void {
    this.highlightElement.innerHTML = renderHighlightedValue(this.textarea.value);
    this.syncScroll();
  }

  private syncScroll(): void {
    this.highlightElement.scrollTop = this.textarea.scrollTop;
    this.highlightElement.scrollLeft = this.textarea.scrollLeft;
  }
}
