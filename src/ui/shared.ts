export type ContainerTarget = string | HTMLElement;

export function resolveContainer(target: ContainerTarget): HTMLElement {
  if (typeof target === "string") {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) throw new Error(`Container "${target}" not found`);
    return el;
  }
  return target;
}

export function injectStyleOnce(id: string, cssText: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = cssText;
  document.head.appendChild(style);
}

export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
