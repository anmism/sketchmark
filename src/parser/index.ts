// ============================================================
// sketchmark - Parser  (Tokens -> DiagramAST)
// ============================================================

import { tokenize, Token } from "./tokenizer";
import {
  applyPluginAstTransforms,
  applyPluginPreprocessors,
} from "../plugins";
import type {
  DiagramAST,
  ASTNode,
  ASTEdge,
  ASTGroup,
  ASTStep,
  ASTBeat,
  ASTChart,
  ASTTable,
  NodeShape,
  EdgeConnector,
  EdgeAnchor,
  LayoutType,
  StyleProps,
  AnimationAction,
  AnimationTrigger,
  AlignItems,
  JustifyContent,
  ASTMarkdown,
  StepPace,
  GroupChildRef,
} from "../ast/types";
import type { ParseOptions } from "../plugins";

export type { DiagramAST } from "../ast/types";

type AuthoredEntityKind = "node" | "group" | "table" | "chart" | "markdown";

let _uid = 0;
function uid(prefix: string) {
  return `${prefix}_${++_uid}`;
}

function resetUid() {
  _uid = 0;
}

const SHAPES: NodeShape[] = [
  "box",
  "circle",
  "diamond",
  "hexagon",
  "triangle",
  "cylinder",
  "parallelogram",
  "text",
  "image",
  "icon",
  "line",
  "path",
];

const CHART_TYPES = [
  "bar-chart",
  "line-chart",
  "pie-chart",
  "donut-chart",
  "scatter-chart",
  "area-chart",
];

export class ParseError extends Error {
  constructor(
    msg: string,
    public line: number,
    public col: number,
  ) {
    super(`[ParseError L${line}:${col}] ${msg}`);
    this.name = "ParseError";
  }
}

function propsToStyle(p: Record<string, string>): StyleProps {
  const s: StyleProps = {};
  if (p.fill) s.fill = p.fill;
  if (p.stroke) s.stroke = p.stroke;
  if (p["stroke-width"]) s.strokeWidth = parseFloat(p["stroke-width"]);
  if (p.color) s.color = p.color;
  if (p.opacity) s.opacity = parseFloat(p.opacity);
  if (p["font-size"]) s.fontSize = parseFloat(p["font-size"]);
  if (p["font-weight"]) s.fontWeight = p["font-weight"];
  if (p["text-align"]) s.textAlign = p["text-align"] as StyleProps["textAlign"];
  if (p.padding) s.padding = parseFloat(p.padding);
  if (p["vertical-align"]) {
    s.verticalAlign = p["vertical-align"] as StyleProps["verticalAlign"];
  }
  if (p["line-height"]) s.lineHeight = parseFloat(p["line-height"]);
  if (p["letter-spacing"]) s.letterSpacing = parseFloat(p["letter-spacing"]);
  if (p.font) s.font = p.font;

  const dashVal = p.dash || p["stroke-dash"];
  if (dashVal) {
    const parts = dashVal
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (parts.length) s.strokeDash = parts;
  }

  return s;
}

function isValueToken(t?: Token): t is Token {
  return !!t && (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD");
}

function isPropKeyToken(t?: Token): t is Token {
  return !!t && (t.type === "IDENT" || t.type === "KEYWORD");
}

export function parse(src: string, options: ParseOptions = {}): DiagramAST {
  resetUid();

  const preparedSource = applyPluginPreprocessors(src, options.plugins);

  const tokens = tokenize(preparedSource).filter(
    (t) => t.type !== "NEWLINE" || t.value === "\n",
  );

  const flat: Token[] = [];
  let lastNL = false;
  for (const t of tokens) {
    if (t.type === "NEWLINE") {
      if (!lastNL) flat.push(t);
      lastNL = true;
    } else {
      flat.push(t);
      lastNL = false;
    }
  }

  const ast: DiagramAST = {
    kind: "diagram",
    layout: "column",
    style: {},
    nodes: [],
    edges: [],
    groups: [],
    steps: [],
    charts: [],
    tables: [],
    markdowns: [],
    styles: {},
    themes: {},
    config: {},
    rootOrder: [],
  };

  const authoredEntityKinds = new Map<string, AuthoredEntityKind>();
  const unresolvedGroupItems = new Map<string, string[]>();
  const groupTokens = new Map<string, Token>();

  let i = 0;
  const cur = () => flat[i] ?? flat[flat.length - 1];
  const peek1 = () => flat[i + 1] ?? flat[flat.length - 1];
  const skip = () => i++;
  const skipNL = () => {
    while (cur().type === "NEWLINE") skip();
  };

  function lineTokens(): Token[] {
    const acc: Token[] = [];
    while (cur().type !== "NEWLINE" && cur().type !== "EOF") {
      acc.push(cur());
      skip();
    }
    if (cur().type === "NEWLINE") skip();
    return acc;
  }

  function requireExplicitId(keywordTok: Token, toks: Token[]): string {
    const first = toks[0];
    if (!isValueToken(first) || toks[1]?.type === "EQUALS") {
      throw new ParseError(
        `${keywordTok.value} requires an explicit id before properties`,
        keywordTok.line,
        keywordTok.col,
      );
    }
    return first.value;
  }

  function parseSimpleProps(toks: Token[], startIndex: number): Record<string, string> {
    const props: Record<string, string> = {};
    let j = startIndex;

    while (j < toks.length - 1) {
      const key = toks[j];
      const eq = toks[j + 1];
      if (isPropKeyToken(key) && eq?.type === "EQUALS" && j + 2 < toks.length) {
        props[key.value] = toks[j + 2].value;
        j += 3;
      } else {
        j++;
      }
    }

    return props;
  }

  function parseConfigValue(value: string): string | number | boolean {
    if (value === "true" || value === "on") return true;
    if (value === "false" || value === "off") return false;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  }

  function applyRootProps(props: Record<string, string>): void {
    const styleProps = propsToStyle(props);
    const styleKeys = new Set([
      "fill",
      "stroke",
      "stroke-width",
      "color",
      "opacity",
      "font-size",
      "font-weight",
      "font",
      "dash",
      "stroke-dash",
      "padding",
      "text-align",
      "vertical-align",
      "line-height",
      "letter-spacing",
    ]);
    ast.style = { ...(ast.style ?? {}), ...styleProps };

    if (props.layout) {
      ast.layout = props.layout as LayoutType;
    }
    if (props.width !== undefined) {
      ast.width = parseFloat(props.width);
    }
    if (props.height !== undefined) {
      ast.height = parseFloat(props.height);
    }

    if (props.font !== undefined) {
      ast.config.font = parseConfigValue(props.font);
    }

    for (const [key, value] of Object.entries(props)) {
      if (key === "layout" || key === "width" || key === "height") continue;
      if (styleKeys.has(key)) continue;
      ast.config[key] = parseConfigValue(value);
    }
  }

  function parseGroupProps(
    toks: Token[],
    startIndex: number,
  ): { props: Record<string, string>; itemIds: string[] } {
    const props: Record<string, string> = {};
    const itemIds: string[] = [];
    let j = startIndex;

    while (j < toks.length) {
      const key = toks[j];
      const eq = toks[j + 1];

      if (!isPropKeyToken(key) || eq?.type !== "EQUALS") {
        j++;
        continue;
      }

      if (key.value === "items") {
        const open = toks[j + 2];
        if (open?.type !== "LBRACKET") {
          throw new ParseError(
            `items must use bracket syntax like items=[a,b]`,
            key.line,
            key.col,
          );
        }

        j += 3;
        while (j < toks.length && toks[j].type !== "RBRACKET") {
          const tok = toks[j];
          if (tok.type === "COMMA") {
            j++;
            continue;
          }
          if (!isValueToken(tok)) {
            const invalidTok = toks[j]!;
            throw new ParseError(
              `items can only contain ids like items=[a,b]`,
              invalidTok.line,
              invalidTok.col,
            );
          }
          itemIds.push(tok.value);
          j++;
          if (toks[j]?.type === "COMMA") {
            j++;
          } else if (toks[j] && toks[j].type !== "RBRACKET") {
            throw new ParseError(
              `Expected ',' or ']' in items list`,
              toks[j].line,
              toks[j].col,
            );
          }
        }

        if (toks[j]?.type !== "RBRACKET") {
          throw new ParseError(
            `Unterminated items list; expected ']'`,
            key.line,
            key.col,
          );
        }

        j++;
        continue;
      }

      if (j + 2 < toks.length) {
        props[key.value] = toks[j + 2].value;
        j += 3;
      } else {
        j++;
      }
    }

    return { props, itemIds };
  }

  function registerAuthoredId(id: string, kind: AuthoredEntityKind, tok: Token): void {
    const existing = authoredEntityKinds.get(id);
    if (existing) {
      throw new ParseError(
        `Duplicate id "${id}" already declared as a ${existing}`,
        tok.line,
        tok.col,
      );
    }
    authoredEntityKinds.set(id, kind);
  }

  function parseDataArray(): (string | number)[][] {
    const rows: (string | number)[][] = [];
    while (cur().type !== "LBRACKET" && cur().type !== "EOF") skip();
    skip();
    skipNL();

    while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
      skipNL();
      if (cur().type === "RBRACKET" || cur().type === "EOF") break;

      if (cur().type === "LBRACKET") {
        skip();
        const row: (string | number)[] = [];
        while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
          const v = cur();
          if (v.type === "STRING" || v.type === "IDENT" || v.type === "KEYWORD") {
            row.push(v.value);
            skip();
          } else if (v.type === "NUMBER") {
            row.push(parseFloat(v.value));
            skip();
          } else if (v.type === "COMMA" || v.type === "NEWLINE") {
            skip();
          } else {
            break;
          }
        }
        if (cur().type === "RBRACKET") skip();
        rows.push(row);
      } else if (cur().type === "COMMA" || cur().type === "NEWLINE") {
        skip();
      } else {
        skip();
      }
    }

    if (cur().type === "RBRACKET") skip();
    return rows;
  }

  function parseNode(shape: NodeShape): ASTNode {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    const id = requireExplicitId(keywordTok, toks);
    const props = parseSimpleProps(toks, 1);

    const meta = extractNodeMeta(props);
    const node: ASTNode = {
      kind: "node",
      id,
      shape,
      label: props.label || "",
      ...(props["label-dx"] !== undefined
        ? { labelDx: parseFloat(props["label-dx"]) }
        : {}),
      ...(props["label-dy"] !== undefined
        ? { labelDy: parseFloat(props["label-dy"]) }
        : {}),
      ...(props.width ? { width: parseFloat(props.width) } : {}),
      ...(props.height ? { height: parseFloat(props.height) } : {}),
      ...(props.x ? { x: parseFloat(props.x) } : {}),
      ...(props.y ? { y: parseFloat(props.y) } : {}),
      ...(props.deg ? { deg: parseFloat(props.deg) } : {}),
      ...(props.dx ? { dx: parseFloat(props.dx) } : {}),
      ...(props.dy ? { dy: parseFloat(props.dy) } : {}),
      ...(props.factor ? { factor: parseFloat(props.factor) } : {}),
      ...(props.theme ? { theme: props.theme } : {}),
      ...(meta ? { meta } : {}),
      style: propsToStyle(props),
    };

    if (props.url) node.imageUrl = props.url;
    if (props.name) node.iconName = props.name;
    if (props.value) node.pathData = props.value;

    return node;
  }

  function parseNote(): ASTNode {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    const id = requireExplicitId(keywordTok, toks);
    const props: Record<string, string> = {};
    let j = 1;

    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }

    Object.assign(props, parseSimpleProps(toks, j));

    const meta = extractNodeMeta(props);
    return {
      kind: "node",
      id,
      shape: "note",
      label: (props.label ?? "").replace(/\\n/g, "\n"),
      ...(props["label-dx"] !== undefined
        ? { labelDx: parseFloat(props["label-dx"]) }
        : {}),
      ...(props["label-dy"] !== undefined
        ? { labelDy: parseFloat(props["label-dy"]) }
        : {}),
      theme: props.theme,
      ...(meta ? { meta } : {}),
      style: propsToStyle(props),
      ...(props.width ? { width: parseFloat(props.width) } : {}),
      ...(props.height ? { height: parseFloat(props.height) } : {}),
      ...(props.x ? { x: parseFloat(props.x) } : {}),
      ...(props.y ? { y: parseFloat(props.y) } : {}),
      ...(props.deg ? { deg: parseFloat(props.deg) } : {}),
      ...(props.dx ? { dx: parseFloat(props.dx) } : {}),
      ...(props.dy ? { dy: parseFloat(props.dy) } : {}),
      ...(props.factor ? { factor: parseFloat(props.factor) } : {}),
    };
  }

  function extractNodeMeta(props: Record<string, string>): Record<string, string> | undefined {
    const meta: Record<string, string> = {};

    if (props["animation-parent"]) {
      meta.animationParent = props["animation-parent"];
    }

    return Object.keys(meta).length ? meta : undefined;
  }

  function parseGroup(): ASTGroup {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    if (toks.some((t) => t.type === "LBRACE" || t.type === "RBRACE")) {
      throw new ParseError(
        `Nested group blocks were removed. Use ${keywordTok.value} <id> items=[...] instead.`,
        keywordTok.line,
        keywordTok.col,
      );
    }

    const id = requireExplicitId(keywordTok, toks);
    const props: Record<string, string> = {};
    let j = 1;

    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }

    const parsed = parseGroupProps(toks, j);
    Object.assign(props, parsed.props);

    skipNL();
    if (cur().type === "LBRACE") {
      throw new ParseError(
        `Nested group blocks were removed. Use ${keywordTok.value} ${id} items=[...] instead.`,
        cur().line,
        cur().col,
      );
    }

    unresolvedGroupItems.set(id, parsed.itemIds);
    groupTokens.set(id, keywordTok);

    return {
      kind: "group",
      id,
      label: props.label ?? "",
      labelDx:
        props["label-dx"] !== undefined ? parseFloat(props["label-dx"]) : undefined,
      labelDy:
        props["label-dy"] !== undefined ? parseFloat(props["label-dy"]) : undefined,
      children: [],
      layout: props.layout as LayoutType | undefined,
      columns:
        props.columns !== undefined ? parseInt(props.columns, 10) : undefined,
      padding:
        props.padding !== undefined ? parseInt(props.padding, 10) : undefined,
      gap: props.gap !== undefined ? parseInt(props.gap, 10) : undefined,
      align: props.align as AlignItems | undefined,
      justify: props.justify as JustifyContent | undefined,
      theme: props.theme,
      style: propsToStyle(props),
      x: props.x !== undefined ? parseFloat(props.x) : undefined,
      y: props.y !== undefined ? parseFloat(props.y) : undefined,
      width: props.width !== undefined ? parseFloat(props.width) : undefined,
      height: props.height !== undefined ? parseFloat(props.height) : undefined,
    };
  }

  function parseEdge(
    fromId: string,
    connector: string,
    rest: Token[],
  ): ASTEdge {
    const toTok = rest.shift();
    if (!toTok) throw new ParseError("Expected edge target", 0, 0);

    const props: Record<string, string> = {};
    let j = 0;
    while (j < rest.length) {
      const t = rest[j];
      if (
        (t.type === "IDENT" || t.type === "KEYWORD") &&
        j + 1 < rest.length &&
        rest[j + 1].type === "EQUALS"
      ) {
        props[t.value] = rest[j + 2]?.value ?? "";
        j += 3;
      } else {
        j++;
      }
    }

    const dashed =
      connector.includes("--") ||
      connector.includes(".-") ||
      connector.includes("-.");
    const bidirectional = connector.includes("<") && connector.includes(">");

    return {
      kind: "edge",
      id: uid("edge"),
      from: fromId,
      to: toTok.value,
      connector: connector as EdgeConnector,
      label: props.label,
      labelDx:
        props["label-dx"] !== undefined ? parseFloat(props["label-dx"]) : undefined,
      labelDy:
        props["label-dy"] !== undefined ? parseFloat(props["label-dy"]) : undefined,
      fromAnchor: props["anchor-from"] as EdgeAnchor | undefined,
      toAnchor: props["anchor-to"] as EdgeAnchor | undefined,
      dashed,
      bidirectional,
      style: propsToStyle(props),
    };
  }

  function parseStep(): ASTStep {
    skip();
    const toks = lineTokens();
    const action = (toks[0]?.value ?? "highlight") as AnimationAction;
    let target = toks[1]?.value ?? "";
    if (toks[2]?.type === "ARROW" && toks[3]) {
      target = `${toks[1].value}${toks[2].value}${toks[3].value}`;
    }

    const step: ASTStep = { kind: "step", action, target };

    if (action === "narrate") {
      step.target = "";
      step.value = toks[1]?.value ?? "";
    }

    if (action === "bracket" && toks.length >= 3) {
      step.target = toks[1]?.value ?? "";
      step.target2 = toks[2]?.value ?? "";
    }

    const kvStart = action === "bracket" ? 3 : 2;
    for (let j = kvStart; j < toks.length; j++) {
      const k = toks[j]?.value;
      const eq = toks[j + 1];
      const vt = toks[j + 2];

      if (eq?.type === "EQUALS" && vt) {
        if (k === "dx") {
          step.dx = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "dy") {
          step.dy = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "duration") {
          step.duration = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "delay") {
          step.delay = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "factor") {
          step.factor = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "deg") {
          step.deg = parseFloat(vt.value);
          j += 2;
          continue;
        }
        if (k === "fill" || k === "color") {
          step.value = vt.value;
          j += 2;
          continue;
        }
        if (k === "pace") {
          step.pace = vt.value as StepPace;
          j += 2;
          continue;
        }
      }

      if (k === "delay" && eq?.type === "NUMBER") {
        step.delay = parseFloat(eq.value);
        j++;
        continue;
      }
      if (k === "duration" && eq?.type === "NUMBER") {
        step.duration = parseFloat(eq.value);
        j++;
        continue;
      }
      if (k === "trigger") {
        step.trigger = eq?.value as AnimationTrigger;
        j++;
      }
    }

    return step;
  }

  function parseChart(chartType: string): ASTChart {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    const id = requireExplicitId(keywordTok, toks);
    const props = parseSimpleProps(toks, 1);
    let dataRows: (string | number)[][] = [];

    skipNL();
    while (cur().type !== "EOF" && cur().value !== "end") {
      skipNL();
      if (cur().type === "RBRACE") break;

      const v = cur().value;
      if (v === "data") {
        dataRows = parseDataArray();
      } else if (
        (cur().type === "IDENT" || cur().type === "KEYWORD") &&
        peek1().type === "EQUALS"
      ) {
        const key = cur().value;
        skip();
        skip();
        props[key] = cur().value;
        skip();
      } else if (
        SHAPES.includes(v as NodeShape) ||
        v === "step" ||
        v === "group" ||
        v === "bare" ||
        v === "note" ||
        v === "table" ||
        v === "config" ||
        v === "theme" ||
        v === "style" ||
        v === "markdown" ||
        CHART_TYPES.includes(v)
      ) {
        break;
      } else if (peek1().type === "ARROW") {
        break;
      } else {
        skip();
      }
    }

    const headers = dataRows[0]?.map(String) ?? [];
    const rows = dataRows.slice(1);

    return {
      kind: "chart",
      id,
      chartType: chartType.replace("-chart", "") as ASTChart["chartType"],
      label: props.label ?? props.title,
      data: { headers, rows },
      x: props.x ? parseFloat(props.x) : undefined,
      y: props.y ? parseFloat(props.y) : undefined,
      width: props.width ? parseFloat(props.width) : undefined,
      height: props.height ? parseFloat(props.height) : undefined,
      theme: props.theme,
      style: propsToStyle(props),
    };
  }

  function parseTable(): ASTTable {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    const id = requireExplicitId(keywordTok, toks);
    const props: Record<string, string> = {};
    let j = 1;

    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }

    Object.assign(props, parseSimpleProps(toks, j));

    const table: ASTTable = {
      kind: "table",
      id,
      label: props.label ?? "",
      rows: [],
      x: props.x ? parseFloat(props.x) : undefined,
      y: props.y ? parseFloat(props.y) : undefined,
      theme: props.theme,
      style: propsToStyle(props),
    };

    skipNL();
    if (cur().type === "LBRACE") {
      skip();
      skipNL();
    }

    while (
      cur().type !== "RBRACE" &&
      cur().value !== "end" &&
      cur().type !== "EOF"
    ) {
      skipNL();
      if (cur().type === "RBRACE") break;

      const v = cur().value;
      if (v === "header" || v === "row") {
        skip();
        const cells: string[] = [];
        while (cur().type !== "NEWLINE" && cur().type !== "EOF") {
          if (
            cur().type === "STRING" ||
            cur().type === "IDENT" ||
            cur().type === "NUMBER" ||
            cur().type === "KEYWORD"
          ) {
            cells.push(cur().value);
          }
          skip();
        }
        if (cur().type === "NEWLINE") skip();
        table.rows.push({ kind: v === "header" ? "header" : "data", cells });
      } else {
        skip();
      }
    }

    if (cur().type === "RBRACE") skip();
    return table;
  }

  function parseMarkdown(): ASTMarkdown {
    const keywordTok = cur();
    skip();
    const toks = lineTokens();

    const id = requireExplicitId(keywordTok, toks);
    const props = parseSimpleProps(toks, 1);

    skipNL();
    let content = "";
    if (cur().type === "STRING_BLOCK") {
      content = cur().value;
      skip();
    }

    return {
      kind: "markdown",
      id,
      content: content.trim(),
      x: props.x ? parseFloat(props.x) : undefined,
      y: props.y ? parseFloat(props.y) : undefined,
      width: props.width ? parseFloat(props.width) : undefined,
      height: props.height ? parseFloat(props.height) : undefined,
      theme: props.theme,
      style: propsToStyle(props),
    };
  }

  skipNL();
  if (cur().value === "diagram") {
    skip();
    const toks = lineTokens();
    const props = parseSimpleProps(toks, 0);
    applyRootProps(props);
  }
  skipNL();

  while (cur().type !== "EOF" && cur().value !== "end") {
    skipNL();
    const t = cur();
    const v = t.value;

    if (t.type === "NEWLINE") {
      skip();
      continue;
    }
    if (v === "diagram") {
      lineTokens();
      continue;
    }
    if (v === "end") break;

    if (v === "direction") {
      lineTokens();
      continue;
    }

    if (v === "layout") {
      throw new ParseError(
        `Root layout must be declared on the diagram line, e.g. diagram layout=absolute`,
        t.line,
        t.col,
      );
      continue;
    }

    if (v === "title") {
      skip();
      const toks = lineTokens();
      const labelProp = toks.find(
        (t2, idx) => t2.value === "label" && toks[idx + 1]?.type === "EQUALS",
      );
      if (labelProp) {
        const idx = toks.indexOf(labelProp);
        ast.title = toks[idx + 2]?.value ?? "";
      } else {
        ast.title = toks.map((t2) => t2.value).join(" ").replace(/"/g, "");
      }
      continue;
    }

    if (v === "description") {
      skip();
      ast.description = lineTokens()
        .map((t2) => t2.value)
        .join(" ")
        .replace(/"/g, "");
      continue;
    }

    if (v === "config") {
      throw new ParseError(
        `Root config must be declared on the diagram line, e.g. diagram gap=40 margin=0 tts=true`,
        t.line,
        t.col,
      );
      continue;
    }

    if (v === "style") {
      skip();
      const targetId = cur().value;
      skip();
      const props = parseSimpleProps(lineTokens(), 0);
      ast.styles[targetId] = { ...ast.styles[targetId], ...propsToStyle(props) };
      continue;
    }

    if (v === "theme") {
      skip();
      const toks = lineTokens();
      const themeId = toks[0]?.value;
      if (!themeId) continue;
      ast.themes[themeId] = propsToStyle(parseSimpleProps(toks, 1));
      continue;
    }

    if (v === "group" || v === "bare") {
      const isBare = v === "bare";
      const grp = parseGroup();
      registerAuthoredId(grp.id, "group", t);

      if (isBare) {
        grp.label = "";
        grp.padding = grp.padding ?? 0;
        grp.style = {
          ...grp.style,
          fill: grp.style?.fill ?? "none",
          stroke: grp.style?.stroke ?? "none",
          strokeWidth: grp.style?.strokeWidth ?? 0,
        };
      }

      ast.groups.push(grp);
      ast.rootOrder.push({ kind: "group", id: grp.id });
      continue;
    }

    if (v === "table") {
      const tbl = parseTable();
      registerAuthoredId(tbl.id, "table", t);
      ast.tables.push(tbl);
      ast.rootOrder.push({ kind: "table", id: tbl.id });
      continue;
    }

    if (v === "note") {
      const note = parseNote();
      registerAuthoredId(note.id, "node", t);
      ast.nodes.push(note);
      ast.rootOrder.push({ kind: "node", id: note.id });
      continue;
    }

    if (v === "beat") {
      skip();
      skipNL();
      if (cur().type === "LBRACE") {
        skip();
        skipNL();
      }
      const children: ASTStep[] = [];
      while (
        cur().type !== "RBRACE" &&
        cur().value !== "end" &&
        cur().type !== "EOF"
      ) {
        skipNL();
        if (cur().type === "RBRACE") break;
        if (cur().value === "step") {
          children.push(parseStep());
        } else {
          skip();
        }
      }
      if (cur().type === "RBRACE") skip();
      ast.steps.push({ kind: "beat", children } as ASTBeat);
      continue;
    }

    if (v === "step") {
      ast.steps.push(parseStep());
      continue;
    }

    if (CHART_TYPES.includes(v)) {
      const chart = parseChart(v);
      registerAuthoredId(chart.id, "chart", t);
      ast.charts.push(chart);
      ast.rootOrder.push({ kind: "chart", id: chart.id });
      continue;
    }

    if (v === "markdown") {
      const md = parseMarkdown();
      registerAuthoredId(md.id, "markdown", t);
      ast.markdowns.push(md);
      ast.rootOrder.push({ kind: "markdown", id: md.id });
      continue;
    }

    if (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD") {
      const nextTok = flat[i + 1];
      if (nextTok && nextTok.type === "ARROW") {
        const lineToks = lineTokens();
        if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
          const fromId = lineToks[0].value;
          const connector = lineToks[1].value;
          ast.edges.push(parseEdge(fromId, connector, lineToks.slice(2)));
          continue;
        }
      }
    }

    if (SHAPES.includes(v as NodeShape)) {
      const node = parseNode(v as NodeShape);
      registerAuthoredId(node.id, "node", t);
      ast.nodes.push(node);
      ast.rootOrder.push({ kind: "node", id: node.id });
      continue;
    }

    skip();
  }

  const allKnownIds = new Set<string>(authoredEntityKinds.keys());
  for (const edge of ast.edges) {
    for (const id of [edge.from, edge.to]) {
      if (allKnownIds.has(id)) continue;
      allKnownIds.add(id);
      ast.nodes.push({
        kind: "node",
        id,
        shape: "box",
        label: id,
        style: {},
      });
    }
  }

  const entityKindById = new Map<string, GroupChildRef["kind"]>();
  ast.nodes.forEach((node) => entityKindById.set(node.id, "node"));
  ast.groups.forEach((group) => entityKindById.set(group.id, "group"));
  ast.tables.forEach((table) => entityKindById.set(table.id, "table"));
  ast.charts.forEach((chart) => entityKindById.set(chart.id, "chart"));
  ast.markdowns.forEach((md) => entityKindById.set(md.id, "markdown"));

  for (const group of ast.groups) {
    const itemIds = unresolvedGroupItems.get(group.id) ?? [];
    group.children = itemIds.map((itemId) => {
      if (itemId === group.id) {
        const tok = groupTokens.get(group.id) ?? cur();
        throw new ParseError(
          `Group "${group.id}" cannot include itself in items=[...]`,
          tok.line,
          tok.col,
        );
      }

      const kind = entityKindById.get(itemId);
      if (!kind) {
        const tok = groupTokens.get(group.id) ?? cur();
        throw new ParseError(
          `Group "${group.id}" references unknown item "${itemId}" in items=[...]`,
          tok.line,
          tok.col,
        );
      }

      return { kind, id: itemId };
    });
  }

  const parentByItemId = new Map<string, string>();
  for (const group of ast.groups) {
    for (const child of group.children) {
      const existingParent = parentByItemId.get(child.id);
      if (existingParent) {
        const tok = groupTokens.get(group.id) ?? cur();
        throw new ParseError(
          `Item "${child.id}" cannot belong to both "${existingParent}" and "${group.id}"`,
          tok.line,
          tok.col,
        );
      }
      parentByItemId.set(child.id, group.id);
    }
  }

  const groupsById = new Map(ast.groups.map((group) => [group.id, group]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visitGroup(groupId: string): void {
    if (visiting.has(groupId)) {
      const start = stack.indexOf(groupId);
      const cycle = (start >= 0 ? stack.slice(start) : stack).concat(groupId);
      const tok = groupTokens.get(groupId) ?? cur();
      throw new ParseError(
        `Group cycle detected: ${cycle.join(" -> ")}`,
        tok.line,
        tok.col,
      );
    }
    if (visited.has(groupId)) return;

    visiting.add(groupId);
    stack.push(groupId);

    const group = groupsById.get(groupId);
    if (group) {
      for (const child of group.children) {
        if (child.kind === "group") visitGroup(child.id);
      }
    }

    stack.pop();
    visiting.delete(groupId);
    visited.add(groupId);
  }

  for (const group of ast.groups) visitGroup(group.id);

  for (const node of ast.nodes) {
    if (ast.styles[node.id]) {
      node.style = { ...ast.styles[node.id], ...node.style };
    }
  }

  return applyPluginAstTransforms(ast, options.plugins);
}
