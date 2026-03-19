// ============================================================
// sketchmark — Parser  (Tokens → DiagramAST)
// ============================================================

import { tokenize, Token, KEYWORDS } from "./tokenizer";
import type {
  DiagramAST,
  ASTNode,
  ASTEdge,
  ASTGroup,
  ASTStep,
  ASTChart,
  ASTTable,
  ASTNote,
  NodeShape,
  EdgeConnector,
  LayoutType,
  StyleProps,
  AnimationAction,
  AnimationTrigger,
  AlignItems,
  JustifyContent,
  GroupChildRef,
  RootItemRef,
} from "../ast/types";

export type { DiagramAST } from "../ast/types";

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
  if (p.radius) s.radius = parseFloat(p.radius);
  if (p.shadow) s.shadow = p.shadow === "true";
  if (p["font-size"]) s.fontSize = parseFloat(p["font-size"]);
  if (p["font-weight"]) s.fontWeight = p["font-weight"];
  if (p["dash"]) {
    const parts = p["dash"]
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (parts.length) s.strokeDash = parts;
  }
  return s;
}

export function parse(src: string): DiagramAST {
  resetUid();
  const tokens = tokenize(src).filter(
    (t) => t.type !== "NEWLINE" || t.value === "\n",
  );

  // Collapse multiple consecutive NEWLINEs into one
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
    nodes: [],
    edges: [],
    groups: [],
    steps: [],
    notes: [],
    charts: [],
    tables: [],
    styles: {},
    themes: {},
    config: {},
    rootOrder: [],
  };

  const nodeIds = new Set<string>();
  const tableIds = new Set<string>();
  const noteIds = new Set<string>();
  const chartIds = new Set<string>();
  const groupIds = new Set<string>();

  let i = 0;
  const cur = () => flat[i] ?? flat[flat.length - 1];
  const peek1 = () => flat[i + 1] ?? flat[flat.length - 1];
  const skip = () => i++;
  const skipNL = () => {
    while (cur().type === "NEWLINE") skip();
  };

  // Consume until EOL, return all tokens
  function lineTokens(): Token[] {
    const acc: Token[] = [];
    while (cur().type !== "NEWLINE" && cur().type !== "EOF") {
      acc.push(cur());
      skip();
    }
    if (cur().type === "NEWLINE") skip();
    return acc;
  }

  function parseDataArray(): (string | number)[][] {
    const rows: (string | number)[][] = [];
    while (cur().type !== "LBRACKET" && cur().type !== "EOF") skip();
    skip(); // outer [
    skipNL();
    while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
      skipNL();
      if (cur().type === "RBRACKET" || cur().type === "EOF") break; // ← ADD THIS LINE
      if (cur().type === "LBRACKET") {
        skip();
        const row: (string | number)[] = [];
        while (cur().type !== "RBRACKET" && cur().type !== "EOF") {
          const v = cur();
          if (
            v.type === "STRING" ||
            v.type === "IDENT" ||
            v.type === "KEYWORD"
          ) {
            row.push(v.value);
            skip();
          } else if (v.type === "NUMBER") {
            row.push(parseFloat(v.value));
            skip();
          } else if (v.type === "COMMA" || v.type === "NEWLINE") {
            skip();
          } else break;
        }
        if (cur().type === "RBRACKET") skip();
        rows.push(row);
      } else if (cur().type === "COMMA" || cur().type === "NEWLINE") {
        skip();
      } else skip();
    }
    if (cur().type === "RBRACKET") skip();
    return rows;
  }

  function parseNode(shape: NodeShape, groupId?: string): ASTNode {
    skip(); // shape keyword
    const toks = lineTokens();

    let id = groupId ? groupId + "_" + uid(shape) : uid(shape);
    const props: Record<string, string> = {};
    let j = 0;

    // First token may be the node id
    if (
      j < toks.length &&
      (toks[j].type === "IDENT" || toks[j].type === "STRING")
    ) {
      id = toks[j++].value;
    }

    // Remaining tokens are key=value pairs
    while (j < toks.length) {
      const t = toks[j];
      if (
        (t.type === "IDENT" || t.type === "KEYWORD") &&
        j + 1 < toks.length &&
        toks[j + 1].type === "EQUALS"
      ) {
        const key = t.value;
        j += 2;
        if (j < toks.length) {
          props[key] = toks[j].value;
          j++;
        }
      } else j++;
    }

    const node: ASTNode = {
      kind: "node",
      id,
      shape,
      label: props.label || id,
      ...(groupId ? { groupId } : {}),
      ...(props.width ? { width: parseFloat(props.width) } : {}),
      ...(props.height ? { height: parseFloat(props.height) } : {}),
      ...(props.theme ? { theme: props.theme } : {}),
      style: propsToStyle(props),
    };
    if (props.url) node.imageUrl = props.url;
    return node;
  }

  function parseEdge(
    fromId: string,
    connector: string,
    rest: Token[],
  ): ASTEdge {
    const toTok = rest.shift();
    if (!toTok) throw new ParseError("Expected edge target", 0, 0);
    const toId = toTok.value;
    const props: Record<string, string> = {};
    let j = 0;
    while (j < rest.length) {
      const t = rest[j];
      if (
        (t.type === "IDENT" || t.type === "KEYWORD") &&
        j + 1 < rest.length &&
        rest[j + 1].type === "EQUALS"
      ) {
        const key = t.value;
        j += 2;
        if (j < rest.length) {
          props[key] = rest[j].value;
          j++;
        }
      } else j++;
    }
    const dashed =
      connector.includes("--") ||
      connector.includes(".-") ||
      connector.includes("-.");
    const bidir = connector.includes("<") && connector.includes(">");
    return {
      kind: "edge",
      id: uid("edge"),
      from: fromId,
      to: toId,
      connector: connector as EdgeConnector,
      label: props.label,
      dashed,
      bidirectional: bidir,
      style: propsToStyle(props),
    };
  }

  // ── parseNote ────────────────────────────────────────────
  function parseNote(groupId?: string): ASTNote {
    skip(); // 'note'
    const toks = lineTokens();

    let id = groupId ? groupId + "_" + uid("note") : uid("note");
    if (toks[0]) id = toks[0].value;

    const props: Record<string, string> = {};
    let j = 1;

    // Backward compat: second token is a bare/quoted string → label
    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }

    // Parse remaining key=value props
    while (j < toks.length - 1) {
      const k = toks[j];
      const eq = toks[j + 1];
      if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
        props[k.value] = toks[j + 2].value;
        j += 3;
      } else j++;
    }

    // Support multiline via literal \n in label string
    const rawLabel = props.label ?? id;

    return {
      kind: "note",
      id,
      label: rawLabel.replace(/\\n/g, "\n"),
      theme: props.theme,
      style: propsToStyle(props),
    };
  }

  // ── parseGroup ───────────────────────────────────────────
  function parseGroup(parentGroupId?: string): ASTGroup {
    skip(); // 'group'
    const toks = lineTokens();

    let id = uid("group");
    if (toks[0]) id = toks[0].value;

    const props: Record<string, string> = {};
    let j = 1;

    // Backward compat: second token is a quoted/bare string (old label syntax)
    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }

    // Parse remaining key=value props
    while (j < toks.length - 1) {
      const k = toks[j];
      const eq = toks[j + 1];
      if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
        props[k.value] = toks[j + 2].value;
        j += 3;
      } else j++;
    }

    const group: ASTGroup = {
      kind: "group",
      id,
      label: props.label ?? id,
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
      width: props.width !== undefined ? parseFloat(props.width) : undefined, // ← add
      height: props.height !== undefined ? parseFloat(props.height) : undefined,
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

      // ── Nested group ──────────────────────────────────
      if (v === "group") {
        const nested = parseGroup(id);
        ast.groups.push(nested);
        groupIds.add(nested.id);
        group.children.push({ kind: "group", id: nested.id });
        continue;
      }

      // ── Table ─────────────────────────────────────────
      if (v === "table") {
        const tbl = parseTable();
        ast.tables.push(tbl);
        tableIds.add(tbl.id);
        group.children.push({ kind: "table", id: tbl.id });
        continue;
      }

      // ── Note ──────────────────────────────────────────
      if (v === "note") {
        const note = parseNote(id);
        ast.notes.push(note);
        noteIds.add(note.id);
        group.children.push({ kind: "note", id: note.id });
        continue;
      }

      // ── Chart ──────────────────────────────────────────

      if (CHART_TYPES.includes(v)) {
        const chart = parseChart(v);
        ast.charts.push(chart);
        chartIds.add(chart.id);
        group.children.push({ kind: "chart", id: chart.id });
        continue;
      }

      // ── Node shape ────────────────────────────────────
      if (SHAPES.includes(v as NodeShape)) {
        const node = parseNode(v as NodeShape, id);
        if (!nodeIds.has(node.id)) {
          nodeIds.add(node.id);
          ast.nodes.push(node);
        }
        group.children.push({ kind: "node", id: node.id });
        continue;
      }

      // ── Edge inside group ─────────────────────────────
      if (
        cur().type === "IDENT" ||
        cur().type === "STRING" ||
        cur().type === "KEYWORD"
      ) {
        const nextTok = flat[i + 1];
        if (nextTok && nextTok.type === "ARROW") {
          const lineToks = lineTokens();
          if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
            const fromId = lineToks[0].value;
            const conn = lineToks[1].value;
            const edge = parseEdge(fromId, conn, lineToks.slice(2));
            ast.edges.push(edge);
          }
          continue;
        }
      }

      skip();
    }
    if (cur().type === "RBRACE") skip();
    return group;
  }

  function parseStep(): ASTStep {
  skip();
  const toks   = lineTokens();
  const action = (toks[0]?.value ?? 'highlight') as AnimationAction;
  let target   = toks[1]?.value ?? '';
  if (toks[2]?.type === 'ARROW' && toks[3]) {
    target = `${toks[1].value}${toks[2].value}${toks[3].value}`;
  }
  const step: ASTStep = { kind: 'step', action, target };

  for (let j = 2; j < toks.length; j++) {
    const k  = toks[j]?.value;
    const eq = toks[j + 1];
    const vt = toks[j + 2];

    // key=value form
    if (eq?.type === 'EQUALS' && vt) {
      if (k === 'dx')       { step.dx       = parseFloat(vt.value); j += 2; continue; }
      if (k === 'dy')       { step.dy       = parseFloat(vt.value); j += 2; continue; }
      if (k === 'duration') { step.duration = parseFloat(vt.value); j += 2; continue; }
      if (k === 'delay')    { step.delay    = parseFloat(vt.value); j += 2; continue; }
      if (k === 'factor')   { step.factor   = parseFloat(vt.value); j += 2; continue; }
      if (k === 'deg')      { step.deg      = parseFloat(vt.value); j += 2; continue; }
      if (k === 'fill')     { step.value    = vt.value;             j += 2; continue; }
      if (k === 'color')    { step.value    = vt.value;             j += 2; continue; }
    }

    // bare key value (legacy)
    if (k === 'delay'    && eq?.type === 'NUMBER') { step.delay    = parseFloat(eq.value); j++; continue; }
    if (k === 'duration' && eq?.type === 'NUMBER') { step.duration = parseFloat(eq.value); j++; continue; }
    if (k === 'trigger')                           { step.trigger  = eq?.value as AnimationTrigger; j++; continue; }
  }

  return step;
}

  // function parseStep(): ASTStep {
  //   skip(); // 'step'
  //   const toks = lineTokens();
  //   const action = (toks[0]?.value ?? "highlight") as AnimationAction;
  //   let target = toks[1]?.value ?? "";
  //   if (toks[2]?.type === "ARROW" && toks[3]) {
  //     target = `${toks[1].value}${toks[2].value}${toks[3].value}`;
  //   }
  //   const step: ASTStep = { kind: "step", action, target };
  //   for (let j = 2; j < toks.length - 1; j++) {
  //     const k = toks[j].value;
  //     const eq = toks[j + 1];
  //     const vt = toks[j + 2];
  //     // key=value form (dx=50, dy=-80, duration=600)
  //     if (eq?.type === "EQUALS" && vt) {
  //       if (k === "dx") {
  //         step.dx = parseFloat(vt.value);
  //         j += 2;
  //         continue;
  //       }
  //       if (k === "dy") {
  //         step.dy = parseFloat(vt.value);
  //         j += 2;
  //         continue;
  //       }
  //       if (k === "duration") {
  //         step.duration = parseFloat(vt.value);
  //         j += 2;
  //         continue;
  //       }
  //       if (k === "delay") {
  //         step.delay = parseFloat(vt.value);
  //         j += 2;
  //         continue;
  //       }
  //     }
  //     // bare key value form (legacy: delay 500, duration 400)
  //     if (k === "delay" && eq?.type === "NUMBER") {
  //       step.delay = parseFloat(eq.value);
  //       j++;
  //     }
  //     if (k === "duration" && eq?.type === "NUMBER") {
  //       step.duration = parseFloat(eq.value);
  //       j++;
  //     }
  //     if (k === "trigger") {
  //       step.trigger = eq?.value as AnimationTrigger;
  //       j++;
  //     }
  //     if (k === "factor") {
  //       step.factor = parseFloat(vt.value);
  //       j += 2;
  //       continue;
  //     }
  //     if (k === "deg") {
  //       step.deg = parseFloat(vt.value);
  //       j += 2;
  //       continue;
  //     }
  //   }
  //   return step;
  // }

  function parseChart(chartType: string): ASTChart {
    skip();
    const toks = lineTokens();
    const id = toks[0]?.value ?? uid("chart");
    const props: Record<string, string> = {};
    let j = 1;
    while (j < toks.length - 1) {
      const k = toks[j];
      const eq = toks[j + 1];
      if (eq?.type === "EQUALS" && j + 2 < toks.length) {
        props[k.value] = toks[j + 2].value;
        j += 3;
      } else j++;
    }
    let dataRows: (string | number)[][] = [];
    skipNL();
    while (cur().type !== "EOF" && cur().value !== "end") {
      skipNL();
      const v = cur().value;
      if (v === "data") {
        dataRows = parseDataArray();
      } else if (
        (cur().type === "IDENT" || cur().type === "KEYWORD") &&
        peek1().type === "EQUALS"
      ) {
        const k = cur().value;
        skip();
        skip();
        props[k] = cur().value;
        skip();
      } else if (
        SHAPES.includes(v as NodeShape) ||
        v === "step" ||
        v === "group" ||
        v === "note" || // ← ADD
        v === "table" ||
        v === "config" || // ← ADD
        v === "theme" || // ← ADD
        v === "style" ||
        CHART_TYPES.includes(v)
      ) {
        break;
      } else if (peek1().type === "ARROW") {
        // ← ADD THIS WHOLE BLOCK
        break;
      } else skip();
    }
    const headers = dataRows[0]?.map(String) ?? [];
    const rows = dataRows.slice(1);
    return {
      kind: "chart",
      id,
      chartType: chartType.replace("-chart", "") as ASTChart["chartType"],
      title: props.title,
      data: { headers, rows },
      width: props.width ? parseFloat(props.width) : undefined,
      height: props.height ? parseFloat(props.height) : undefined,
      theme: props.theme,
      style: propsToStyle(props),
    };
  }

  function parseTable(): ASTTable {
    skip(); // 'table'
    const toks = lineTokens();

    let id = uid("table");
    if (toks[0]) id = toks[0].value;

    const props: Record<string, string> = {};
    let j = 1;
    // label="..." or bare second token
    if (
      toks[1] &&
      (toks[1].type === "STRING" ||
        (toks[1].type === "IDENT" && toks[2]?.type !== "EQUALS"))
    ) {
      props.label = toks[1].value;
      j = 2;
    }
    while (j < toks.length - 1) {
      const k = toks[j],
        eq = toks[j + 1];
      if (eq?.type === "EQUALS" && j + 2 < toks.length) {
        props[k.value] = toks[j + 2].value;
        j += 3;
      } else j++;
    }

    const table: ASTTable = {
      kind: "table",
      id,
      label: props.label ?? id,
      rows: [],
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
            cur().type === "NUMBER"
          ) {
            cells.push(cur().value);
          }
          skip();
        }
        if (cur().type === "NEWLINE") skip();
        table.rows.push({ kind: v === "header" ? "header" : "data", cells });
      } else skip();
    }
    if (cur().type === "RBRACE") skip();
    return table;
  }

  // ── Main parse loop ─────────────────────────────────────
  skipNL();
  if (cur().value === "diagram") skip();
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
      skip();
      continue;
    }
    if (v === "end") break;

    // direction — silently ignored (removed from engine)
    if (v === "direction") {
      lineTokens();
      continue;
    }

    // layout
    if (v === "layout") {
      skip();
      ast.layout = (cur().value as LayoutType) ?? "column";
      skip();
      continue;
    }

    // title
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
        ast.title = toks
          .map((t2) => t2.value)
          .join(" ")
          .replace(/"/g, "");
      }
      continue;
    }

    // description
    if (v === "description") {
      skip();
      ast.description = lineTokens()
        .map((t2) => t2.value)
        .join(" ")
        .replace(/"/g, "");
      continue;
    }

    // config
    if (v === "config") {
      skip();
      const k = cur().value;
      skip();
      if (cur().type === "EQUALS") skip();
      const cv = cur().value;
      skip();
      ast.config[k] = cv;
      continue;
    }

    // style
    if (v === "style") {
      skip();
      const targetId = cur().value;
      skip();
      const lineToks = lineTokens();
      const p: Record<string, string> = {};
      let j = 0;
      while (j < lineToks.length - 1) {
        const k2 = lineToks[j];
        const eq = lineToks[j + 1];
        if (eq.type === "EQUALS") {
          p[k2.value] = lineToks[j + 2]?.value ?? "";
          j += 3;
        } else j++;
      }
      ast.styles[targetId] = { ...ast.styles[targetId], ...propsToStyle(p) };
      continue;
    }

    // theme
    if (v === "theme") {
      skip();
      const toks = lineTokens();
      const themeId = toks[0]?.value;
      if (!themeId) continue;
      const props: Record<string, string> = {};
      let j = 1;
      while (j < toks.length - 1) {
        const k2 = toks[j];
        const eq = toks[j + 1];
        if (eq && eq.type === "EQUALS" && j + 2 < toks.length) {
          props[k2.value] = toks[j + 2].value;
          j += 3;
        } else j++;
      }
      ast.themes[themeId] = propsToStyle(props);
      continue;
    }

    // group
    if (v === "group") {
      const grp = parseGroup();
      ast.groups.push(grp);
      groupIds.add(grp.id);
      ast.rootOrder.push({ kind: "group", id: grp.id });
      continue;
    }

    // table
    if (v === "table") {
      const tbl = parseTable();
      ast.tables.push(tbl);
      tableIds.add(tbl.id);
      ast.rootOrder.push({ kind: "table", id: tbl.id });
      continue;
    }

    // note
    if (v === "note") {
      const note = parseNote();
      ast.notes.push(note);
      noteIds.add(note.id);
      ast.rootOrder.push({ kind: "note", id: note.id });
      continue;
    }

    // step
    if (v === "step") {
      ast.steps.push(parseStep());
      continue;
    }

    // charts
    if (CHART_TYPES.includes(v)) {
      const chart = parseChart(v);
      ast.charts.push(chart);
      chartIds.add(chart.id);
      ast.rootOrder.push({ kind: "chart", id: chart.id }); // ← ADD
      continue;
    }
    // edge:  A -> B  (MUST come before shape check)
    if (t.type === "IDENT" || t.type === "STRING" || t.type === "KEYWORD") {
      const nextTok = flat[i + 1];
      if (nextTok && nextTok.type === "ARROW") {
        const lineToks = lineTokens();
        if (lineToks.length >= 3 && lineToks[1].type === "ARROW") {
          const fromId = lineToks[0].value;
          const conn = lineToks[1].value;
          const edge = parseEdge(fromId, conn, lineToks.slice(2));
          ast.edges.push(edge);
          // Auto-create implied nodes if they don't exist yet
          for (const nid of [fromId, edge.to]) {
            if (
              !nodeIds.has(nid) &&
              !tableIds.has(nid) &&
              !noteIds.has(nid) &&
              !chartIds.has(nid) &&
              !groupIds.has(nid)
            ) {
              nodeIds.add(nid);
              ast.nodes.push({
                kind: "node",
                id: nid,
                shape: "box",
                label: nid,
                style: {},
              });
            }
          }
          continue;
        }
      }
    }

    // node shapes — only reached if NOT followed by an arrow
    if (SHAPES.includes(v as NodeShape)) {
      const node = parseNode(v as NodeShape);
      if (!nodeIds.has(node.id)) {
        nodeIds.add(node.id);
        ast.nodes.push(node);
        ast.rootOrder.push({ kind: "node", id: node.id });
      }
      continue;
    }

    skip();
  }

  // Merge global styles into node styles
  for (const node of ast.nodes) {
    if (ast.styles[node.id]) {
      node.style = { ...ast.styles[node.id], ...node.style };
    }
  }

  console.log(
    "[parse] charts:",
    ast.charts.map((c) => c.id),
  );
  console.log(
    "[parse] rootOrder:",
    ast.rootOrder.map((r) => r.kind + ":" + r.id),
  );

  return ast;
}
