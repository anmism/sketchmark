import type {
  ASTStep,
  ASTStepItem,
  DiagramAST,
  SketchmarkPlugin,
} from "sketchmark";

export interface NotationPluginOptions {
  delimiters?: ReadonlyArray<readonly [string, string]>;
  transformNarration?: boolean;
  transformMarkdown?: boolean;
}

const DEFAULT_DELIMITERS = [
  ["$", "$"],
  ["\\(", "\\)"],
] as const;

const SIMPLE_COMMANDS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  phi: "φ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  cdot: "·",
  times: "×",
  pm: "±",
  mp: "∓",
  neq: "≠",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  approx: "≈",
  sim: "∼",
  circ: "°",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  infty: "∞",
  degree: "°",
  partial: "∂",
  sum: "∑",
  prod: "∏",
  int: "∫",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  in: "∈",
  notin: "∉",
  forall: "∀",
  exists: "∃",
  because: "∵",
  therefore: "∴",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  log: "log",
  ln: "ln",
  left: "",
  right: "",
};

const GROUP_WRAPPER_COMMANDS = new Set([
  "text",
  "mathrm",
  "mathbf",
  "mathit",
  "operatorname",
  "textrm",
  "textbf",
  "mathsf",
  "mathtt",
]);

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

export function notation(options: NotationPluginOptions = {}): SketchmarkPlugin {
  const delimiters = options.delimiters ?? DEFAULT_DELIMITERS;
  const transformNarration = options.transformNarration !== false;
  const transformMarkdown = options.transformMarkdown === true;

  return {
    name: "notation",
    transformAst(ast) {
      return {
        ...ast,
        title: transformOptionalText(ast.title, delimiters),
        description: transformOptionalText(ast.description, delimiters),
        nodes: ast.nodes.map((node) => ({
          ...node,
          label: transformRequiredText(node.label, delimiters),
        })),
        edges: ast.edges.map((edge) => ({
          ...edge,
          label: transformOptionalText(edge.label, delimiters),
        })),
        groups: ast.groups.map((group) => ({
          ...group,
          label: transformRequiredText(group.label, delimiters),
        })),
        tables: ast.tables.map((table) => ({
          ...table,
          label: transformRequiredText(table.label, delimiters),
          rows: table.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => transformRequiredText(cell, delimiters)),
          })),
        })),
        charts: ast.charts.map((chart) => ({
          ...chart,
          label: transformOptionalText(chart.label, delimiters),
          data: {
            headers: chart.data.headers.map((header) => transformRequiredText(header, delimiters)),
            rows: chart.data.rows.map((row) =>
              row.map((value) =>
                typeof value === "string" ? transformRequiredText(value, delimiters) : value,
              ),
            ),
          },
        })),
        markdowns: ast.markdowns.map((markdown) =>
          transformMarkdown
            ? { ...markdown, content: transformRequiredText(markdown.content, delimiters) }
            : markdown,
        ),
        steps: ast.steps.map((step) =>
          transformNarration ? transformStep(step, delimiters) : step,
        ),
      };
    },
  };
}

export function renderMath(text: string): string {
  return renderMathFragment(text.trim());
}

function transformStep(
  step: ASTStepItem,
  delimiters: ReadonlyArray<readonly [string, string]>,
): ASTStepItem {
  if (step.kind === "beat") {
    return {
      ...step,
      children: step.children.map((child) => transformStep(child, delimiters) as ASTStep),
    };
  }
  if (step.action !== "narrate") return step;
  return {
    ...step,
    value: transformText(step.value, delimiters),
  };
}

function transformText(
  value: string | undefined,
  delimiters: ReadonlyArray<readonly [string, string]>,
): string | undefined {
  if (typeof value !== "string" || !value) return value;
  let nextValue = value;
  for (const [open, close] of delimiters) {
    nextValue = replaceDelimited(nextValue, open, close, renderMathFragment);
  }
  return unescapeDelimiters(nextValue, delimiters);
}

function transformRequiredText(
  value: string,
  delimiters: ReadonlyArray<readonly [string, string]>,
): string {
  return transformText(value, delimiters) ?? value;
}

function transformOptionalText(
  value: string | undefined,
  delimiters: ReadonlyArray<readonly [string, string]>,
): string | undefined {
  return transformText(value, delimiters);
}

function replaceDelimited(
  value: string,
  open: string,
  close: string,
  transform: (segment: string) => string,
): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const start = findToken(value, open, index);
    if (start < 0) {
      result += value.slice(index);
      break;
    }

    const end = findToken(value, close, start + open.length);
    if (end < 0) {
      result += value.slice(index);
      break;
    }

    result += value.slice(index, start);
    result += transform(value.slice(start + open.length, end));
    index = end + close.length;
  }

  return result;
}

function findToken(value: string, token: string, start: number): number {
  let index = start;
  while (index < value.length) {
    index = value.indexOf(token, index);
    if (index < 0) return -1;
    if (!isEscaped(value, index)) return index;
    index += token.length;
  }
  return -1;
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function renderMathFragment(value: string): string {
  let nextValue = reviveMathCommands(value);
  let previousValue = "";
  let iterations = 0;

  while (nextValue !== previousValue && iterations < 8) {
    previousValue = nextValue;
    nextValue = replaceCommandWithGroups(nextValue, "\\frac", 2, ([left, right]) =>
      `${renderMathFragment(left)}⁄${renderMathFragment(right)}`,
    );
    nextValue = replaceCommandWithGroups(nextValue, "\\sqrt", 1, ([content]) =>
      `√(${renderMathFragment(content)})`,
    );
    for (const command of GROUP_WRAPPER_COMMANDS) {
      nextValue = replaceCommandWithGroups(nextValue, `\\${command}`, 1, ([content]) =>
        renderMathFragment(content),
      );
    }
    iterations += 1;
  }

  nextValue = nextValue
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\:/g, " ");
  nextValue = replaceSimpleCommands(nextValue);
  nextValue = nextValue.replace(/\^\s*°/g, "°");
  nextValue = replaceScripts(nextValue);
  nextValue = nextValue.replace(/[{}]/g, "");
  nextValue = nextValue.replace(/\s+/g, " ").trim();
  return nextValue;
}

function reviveMathCommands(value: string): string {
  return value
    .replace(/\t(?=[A-Za-z])/g, "\\t")
    .replace(/\n(?=[A-Za-z])/g, "\\n")
    .replace(/\r(?=[A-Za-z])/g, "\\r");
}

function replaceCommandWithGroups(
  value: string,
  command: string,
  arity: number,
  render: (args: string[]) => string,
): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const start = value.indexOf(command, index);
    if (start < 0) {
      result += value.slice(index);
      break;
    }

    result += value.slice(index, start);
    let cursor = start + command.length;
    const args: string[] = [];
    let valid = true;

    for (let argIndex = 0; argIndex < arity; argIndex += 1) {
      cursor = skipWhitespace(value, cursor);
      const group = readBalancedGroup(value, cursor);
      if (!group) {
        valid = false;
        break;
      }
      args.push(group.content);
      cursor = group.end;
    }

    if (!valid) {
      result += command;
      index = start + command.length;
      continue;
    }

    result += render(args);
    index = cursor;
  }

  return result;
}

function readBalancedGroup(
  value: string,
  start: number,
): { content: string; end: number } | null {
  if (value[start] !== "{") return null;

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === "{" && !isEscaped(value, index)) depth += 1;
    if (ch === "}" && !isEscaped(value, index)) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(start + 1, index),
          end: index + 1,
        };
      }
    }
  }

  return null;
}

function skipWhitespace(value: string, start: number): number {
  let index = start;
  while (index < value.length && /\s/.test(value[index] ?? "")) index += 1;
  return index;
}

function replaceSimpleCommands(value: string): string {
  return value.replace(/\\([A-Za-z]+)/g, (_, rawCommand: string) => {
    if (rawCommand in SIMPLE_COMMANDS) return SIMPLE_COMMANDS[rawCommand]!;
    return rawCommand;
  });
}

function replaceScripts(value: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const marker = value[index];
    if (marker !== "^" && marker !== "_") {
      result += marker;
      continue;
    }

    const token = readScriptToken(value, index + 1);
    if (!token) {
      result += marker;
      continue;
    }

    result += applyScript(token.content, marker === "^" ? SUPERSCRIPTS : SUBSCRIPTS, marker);
    index = token.end - 1;
  }

  return result;
}

function readScriptToken(
  value: string,
  start: number,
): { content: string; end: number } | null {
  let cursor = skipWhitespace(value, start);
  if (cursor >= value.length) return null;

  const group = readBalancedGroup(value, cursor);
  if (group) {
    return {
      content: renderMathFragment(group.content),
      end: group.end,
    };
  }

  const single = value[cursor];
  if (!single) return null;
  cursor += 1;
  return {
    content: single,
    end: cursor,
  };
}

function applyScript(
  value: string,
  alphabet: Record<string, string>,
  marker: "^" | "_",
): string {
  let rendered = "";
  for (const ch of value.replace(/\s+/g, "")) {
    const mapped = alphabet[ch];
    if (!mapped) return `${marker}(${value})`;
    rendered += mapped;
  }
  return rendered;
}

function unescapeDelimiters(
  value: string,
  delimiters: ReadonlyArray<readonly [string, string]>,
): string {
  let nextValue = value;
  for (const [open, close] of delimiters) {
    nextValue = nextValue
      .split(`\\${open}`).join(open)
      .split(`\\${close}`).join(close);
  }
  return nextValue;
}
