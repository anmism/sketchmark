import type {
  ASTNode,
  DiagramAST,
  RootItemRef,
  SketchmarkPlugin,
  StyleProps,
} from "sketchmark";

export interface AnnotationPluginOptions {
  color?: string;
  strokeWidth?: number;
  angleRadius?: number;
  rightAngleSize?: number;
  midpointRadius?: number;
  dimensionOffset?: number;
  equalTickSize?: number;
  equalTickSpacing?: number;
  labelOffset?: number;
}

type AnnotationCommandType =
  | "angle"
  | "right-angle"
  | "equal"
  | "midpoint"
  | "dimension";

type AngleMode =
  | "interior"
  | "reflex";

interface AnnotationCommand {
  type: AnnotationCommandType;
  id: string;
  props: Record<string, string>;
  lineNumber: number;
}

interface Point2D {
  x: number;
  y: number;
}

interface ArcGeometry {
  path: string;
  points: Point2D[];
  labelDirection: Point2D;
}

interface EmittedNodes {
  nodes: ASTNode[];
}

const DEFAULTS: Required<AnnotationPluginOptions> = {
  color: "#c85428",
  strokeWidth: 2,
  angleRadius: 28,
  rightAngleSize: 18,
  midpointRadius: 4,
  dimensionOffset: 28,
  equalTickSize: 12,
  equalTickSpacing: 8,
  labelOffset: 12,
};

const SUPPORTED_COMMANDS = new Set<AnnotationCommandType>([
  "angle",
  "right-angle",
  "equal",
  "midpoint",
  "dimension",
]);

const TEXT_STYLE_KEYS = [
  "color",
  "opacity",
  "font-size",
  "font-weight",
  "font",
  "letter-spacing",
  "text-align",
  "vertical-align",
  "line-height",
];

export function annotations(options: AnnotationPluginOptions = {}): SketchmarkPlugin {
  const settings = { ...DEFAULTS, ...options };
  let pendingCommands: AnnotationCommand[] = [];

  return {
    name: "annotations",
    preprocess(source) {
      pendingCommands = [];
      return stripAnnotationCommands(source, pendingCommands);
    },
    transformAst(ast) {
      if (!pendingCommands.length) return ast;
      if (ast.layout !== "absolute") {
        throw new Error('Annotation commands require the root diagram to use "layout absolute"');
      }

      const nodeById = new Map(ast.nodes.map((node) => [node.id, node]));
      const usedIds = new Set(ast.nodes.map((node) => node.id));
      const generatedNodes: ASTNode[] = [];

      for (const command of pendingCommands) {
        const emitted = emitCommand(command, nodeById, usedIds, settings);
        for (const node of emitted.nodes) {
          generatedNodes.push(node);
          nodeById.set(node.id, node);
          usedIds.add(node.id);
        }
      }

      pendingCommands = [];

      const generatedRootOrder: RootItemRef[] = generatedNodes.map((node) => ({
        kind: "node",
        id: node.id,
      }));

      return {
        ...ast,
        nodes: [...ast.nodes, ...generatedNodes],
        rootOrder: [...ast.rootOrder, ...generatedRootOrder],
      };
    },
  };
}

function stripAnnotationCommands(source: string, output: AnnotationCommand[]): string {
  const lines = source.split(/\r?\n/);
  const kept: string[] = [];
  let inTripleQuoteBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (trimmed === '"""') {
      inTripleQuoteBlock = !inTripleQuoteBlock;
      kept.push(line);
      continue;
    }

    if (!inTripleQuoteBlock && trimmed.startsWith("annot.")) {
      output.push(parseAnnotationCommand(trimmed, index + 1));
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

function parseAnnotationCommand(line: string, lineNumber: number): AnnotationCommand {
  const tokens = tokenizeLine(line);
  if (tokens.length < 2) {
    throw new Error(`Invalid annotation command on line ${lineNumber}`);
  }

  const commandToken = tokens[0] ?? "";
  const type = commandToken.slice("annot.".length) as AnnotationCommandType;
  if (!SUPPORTED_COMMANDS.has(type)) {
    throw new Error(`Unsupported annotation command "${commandToken}" on line ${lineNumber}`);
  }

  const id = tokens[1] ?? "";
  if (!id || id.includes("=")) {
    throw new Error(`Annotation command "${commandToken}" requires an explicit id on line ${lineNumber}`);
  }

  const props: Record<string, string> = {};
  for (const token of tokens.slice(2)) {
    const eqIndex = token.indexOf("=");
    if (eqIndex < 1) {
      throw new Error(`Invalid annotation property "${token}" on line ${lineNumber}`);
    }
    props[token.slice(0, eqIndex)] = stripWrapping(token.slice(eqIndex + 1));
  }

  return { type, id, props, lineNumber };
}

function tokenizeLine(line: string): string[] {
  const tokens: string[] = [];
  let index = 0;

  while (index < line.length) {
    while (index < line.length && /\s/.test(line[index] ?? "")) index += 1;
    if (index >= line.length) break;

    const start = index;
    let inQuote = false;
    let listDepth = 0;

    while (index < line.length) {
      const ch = line[index] ?? "";
      if (ch === '"' && line[index - 1] !== "\\") {
        inQuote = !inQuote;
        index += 1;
        continue;
      }
      if (!inQuote) {
        if (ch === "[") listDepth += 1;
        if (ch === "]" && listDepth > 0) listDepth -= 1;
        if (/\s/.test(ch) && listDepth === 0) break;
      }
      index += 1;
    }

    tokens.push(line.slice(start, index));
  }

  return tokens;
}

function stripWrapping(value: string): string {
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

function emitCommand(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  assertUnusedId(command.id, usedIds, command.lineNumber);

  switch (command.type) {
    case "angle":
      return emitAngle(command, nodeById, usedIds, settings);
    case "right-angle":
      return emitRightAngle(command, nodeById, usedIds, settings);
    case "equal":
      return emitEqual(command, nodeById, usedIds, settings);
    case "midpoint":
      return emitMidpoint(command, nodeById, usedIds, settings);
    case "dimension":
      return emitDimension(command, nodeById, usedIds, settings);
  }
}

function emitAngle(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  const a = resolvePoint(nodeById, command.props.a, "a", command.lineNumber);
  const b = resolvePoint(nodeById, command.props.b, "b", command.lineNumber);
  const c = resolvePoint(nodeById, command.props.c, "c", command.lineNumber);
  const radius = readNumber(command.props.radius) ?? settings.angleRadius;
  const u1 = normalize(subtract(a, b), command.lineNumber, command.id);
  const u2 = normalize(subtract(c, b), command.lineNumber, command.id);
  const mode = parseAngleMode(command.props.mode, command.lineNumber);
  const invert = parseInvert(command.props.invert);

  if (mode === "reflex") {
    const geometry = buildAngleArcGeometry(
      b,
      u1,
      u2,
      radius,
      mode,
    );

    const nodes: ASTNode[] = [
      createPathNode(
        command.id,
        geometry.path,
        command.props,
        settings,
        geometry.points,
      ),
    ];

    if (command.props.label) {
      const defaultLabelDistance = Math.max(radius + settings.labelOffset * 1.4, radius * 1.2);
      const labelDistance = readNumber(command.props["label-distance"]) ?? defaultLabelDistance;
      const labelDx = readNumber(command.props["label-dx"]) ?? 0;
      const labelDy = readNumber(command.props["label-dy"]) ?? 0;
      nodes.push(
        createTextNode(
          helperLabelId(command.id, usedIds, command.lineNumber),
          command.props.label,
          add(add(b, scale(geometry.labelDirection, labelDistance)), { x: labelDx, y: labelDy }),
          command.props,
          settings,
          { animationParent: command.id },
        ),
      );
    }

    return { nodes };
  }

  const bisector = pickBisector(u1, u2);
  const start = add(b, scale(u1, radius));
  const end = add(b, scale(u2, radius));
  const controlDistance = angleControlDistance(b, start, end, bisector, radius, invert);
  const control = add(b, scale(bisector, controlDistance));

  const main = createPathNode(
    command.id,
    `M ${formatNumber(start.x)} ${formatNumber(start.y)} Q ${formatNumber(control.x)} ${formatNumber(control.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`,
    command.props,
    settings,
    [start, control, end],
  );

  const nodes = [main];
  if (command.props.label) {
    const defaultLabelDistance = Math.max(controlDistance + settings.labelOffset * 0.75, radius * 0.7);
    const invertedLabelDistance = Math.max(controlDistance + settings.labelOffset * 0.35, radius * 0.45);
    const labelDistance = readNumber(command.props["label-distance"])
      ?? (invert ? invertedLabelDistance : defaultLabelDistance);
      const labelDx = readNumber(command.props["label-dx"]) ?? 0;
      const labelDy = readNumber(command.props["label-dy"]) ?? 0;
      nodes.push(
        createTextNode(
          helperLabelId(command.id, usedIds, command.lineNumber),
          command.props.label,
          add(add(b, scale(bisector, labelDistance)), { x: labelDx, y: labelDy }),
          command.props,
          settings,
          { animationParent: command.id },
        ),
      );
  }

  return { nodes };
}

function emitRightAngle(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  const a = resolvePoint(nodeById, command.props.a, "a", command.lineNumber);
  const b = resolvePoint(nodeById, command.props.b, "b", command.lineNumber);
  const c = resolvePoint(nodeById, command.props.c, "c", command.lineNumber);
  const size = readNumber(command.props.size) ?? settings.rightAngleSize;
  const u1 = normalize(subtract(a, b), command.lineNumber, command.id);
  const u2 = normalize(subtract(c, b), command.lineNumber, command.id);
  const invert = parseInvert(command.props.invert);
  const bisector = pickBisector(u1, u2);
  const dir1 = u1;
  const dir2 = u2;
  const p1 = add(b, scale(dir1, size));
  const p2 = add(p1, scale(dir2, size));
  const p3 = add(b, scale(dir2, size));

  const main = createPathNode(
    command.id,
    `M ${formatNumber(p1.x)} ${formatNumber(p1.y)} L ${formatNumber(p2.x)} ${formatNumber(p2.y)} L ${formatNumber(p3.x)} ${formatNumber(p3.y)}`,
    command.props,
    settings,
    [p1, p2, p3],
  );

  const nodes = [main];
  if (command.props.label) {
    const defaultLabelDistance = size + settings.labelOffset;
    const invertedLabelDistance = Math.max(size - settings.labelOffset, size * 0.55);
    const labelDistance = readNumber(command.props["label-distance"])
      ?? (invert ? invertedLabelDistance : defaultLabelDistance);
      const labelDx = readNumber(command.props["label-dx"]) ?? 0;
      const labelDy = readNumber(command.props["label-dy"]) ?? 0;
      nodes.push(
        createTextNode(
          helperLabelId(command.id, usedIds, command.lineNumber),
          command.props.label,
          add(add(b, scale(bisector, labelDistance)), { x: labelDx, y: labelDy }),
          command.props,
          settings,
          { animationParent: command.id },
        ),
      );
  }

  return { nodes };
}

function emitEqual(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  const from = resolvePoint(nodeById, command.props.from, "from", command.lineNumber);
  const to = resolvePoint(nodeById, command.props.to, "to", command.lineNumber);
  const unit = normalize(subtract(to, from), command.lineNumber, command.id);
  const normal = preferredNormal(unit, parseInvert(command.props.invert));
  const size = readNumber(command.props.size) ?? settings.equalTickSize;
  const spacing = readNumber(command.props.spacing) ?? settings.equalTickSpacing;
  const count = Math.max(1, Math.round(readNumber(command.props.count) ?? 1));
  const midpoint = lerp(from, to, 0.5);
  const offsets = buildOffsets(count, spacing);
  const segments = offsets.map((offset) => {
    const center = add(midpoint, scale(unit, offset));
    return [
      add(center, scale(normal, -size / 2)),
      add(center, scale(normal, size / 2)),
    ];
  });

  const main = createSegmentPathNode(command.id, segments, command.props, settings);
  const nodes = [main];
  if (command.props.label) {
    const labelDx = readNumber(command.props["label-dx"]) ?? 0;
    const labelDy = readNumber(command.props["label-dy"]) ?? 0;
    nodes.push(
      createTextNode(
        helperLabelId(command.id, usedIds, command.lineNumber),
        command.props.label,
        add(add(midpoint, scale(normal, size / 2 + settings.labelOffset)), { x: labelDx, y: labelDy }),
        command.props,
        settings,
        { animationParent: command.id },
      ),
    );
  }

  return { nodes };
}

function emitMidpoint(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  const from = resolvePoint(nodeById, command.props.from, "from", command.lineNumber);
  const to = resolvePoint(nodeById, command.props.to, "to", command.lineNumber);
  const midpoint = lerp(from, to, 0.5);
  const radius = readNumber(command.props.r ?? command.props.radius) ?? settings.midpointRadius;

  const main = createCircleNode(command.id, midpoint, radius, command.props, settings);
  const nodes = [main];
  if (command.props.label) {
    const labelDx = readNumber(command.props["label-dx"]) ?? settings.labelOffset;
    const labelDy = readNumber(command.props["label-dy"]) ?? -settings.labelOffset;
    nodes.push(
      createTextNode(
        helperLabelId(command.id, usedIds, command.lineNumber),
        command.props.label,
        { x: midpoint.x + labelDx, y: midpoint.y + labelDy },
        command.props,
        settings,
        { animationParent: command.id },
      ),
    );
  }

  return { nodes };
}

function emitDimension(
  command: AnnotationCommand,
  nodeById: ReadonlyMap<string, ASTNode>,
  usedIds: ReadonlySet<string>,
  settings: Required<AnnotationPluginOptions>,
): EmittedNodes {
  const from = resolvePoint(nodeById, command.props.from, "from", command.lineNumber);
  const to = resolvePoint(nodeById, command.props.to, "to", command.lineNumber);
  const unit = normalize(subtract(to, from), command.lineNumber, command.id);
  const normal = preferredNormal(unit, parseInvert(command.props.invert));
  const offset = readNumber(command.props.offset) ?? settings.dimensionOffset;
  const arrowSize = readNumber(command.props.arrow) ?? 7;
  const arrowWidth = readNumber(command.props["arrow-width"]) ?? arrowSize * 0.7;
  const a = add(from, scale(normal, offset));
  const b = add(to, scale(normal, offset));

  const segments: Point2D[][] = [
    [from, a],
    [to, b],
    [a, b],
    [a, add(add(a, scale(unit, arrowSize)), scale(normal, arrowWidth / 2))],
    [a, add(add(a, scale(unit, arrowSize)), scale(normal, -arrowWidth / 2))],
    [b, add(add(b, scale(unit, -arrowSize)), scale(normal, arrowWidth / 2))],
    [b, add(add(b, scale(unit, -arrowSize)), scale(normal, -arrowWidth / 2))],
  ];

  const main = createSegmentPathNode(command.id, segments, command.props, settings);
  const nodes = [main];

  if (command.props.label) {
    const midpoint = lerp(a, b, 0.5);
    const labelDx = readNumber(command.props["label-dx"]) ?? 0;
    const labelDy = readNumber(command.props["label-dy"]) ?? 0;
    const labelDistance = readNumber(command.props["label-offset"]) ?? settings.labelOffset;
    nodes.push(
      createTextNode(
        helperLabelId(command.id, usedIds, command.lineNumber),
        command.props.label,
        add(add(midpoint, scale(normal, labelDistance)), { x: labelDx, y: labelDy }),
        command.props,
        settings,
        { animationParent: command.id },
      ),
    );
  }

  return { nodes };
}

function resolvePoint(
  nodeById: ReadonlyMap<string, ASTNode>,
  id: string | undefined,
  propName: string,
  lineNumber: number,
): Point2D {
  if (!id) {
    throw new Error(`Annotation command on line ${lineNumber} requires "${propName}"`);
  }
  const node = nodeById.get(id);
  if (!node) {
    throw new Error(`Unknown point or node "${id}" referenced by "${propName}" on line ${lineNumber}`);
  }
  if (typeof node.x !== "number" || typeof node.y !== "number") {
    throw new Error(`Referenced node "${id}" needs authored x/y coordinates for annotations`);
  }

  const width = node.width ?? 0;
  const height = node.height ?? 0;

  return {
    x: node.x + width / 2,
    y: node.y + height / 2,
  };
}

function createPathNode(
  id: string,
  absolutePath: string,
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
  points: readonly Point2D[],
): ASTNode {
  const bounds = boundsOf(points);
  const pathData = absolutizePath(absolutePath, bounds.minX, bounds.minY);
  return {
    kind: "node",
    id,
    shape: "path",
    label: "",
    pathData,
    x: bounds.minX,
    y: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
    style: buildStrokeStyle(props, settings, "none"),
  };
}

function createSegmentPathNode(
  id: string,
  segments: readonly (readonly Point2D[])[],
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
): ASTNode {
  const points = segments.flat();
  const bounds = boundsOf(points);
  const pathData = segments
    .map((segment) =>
      segment
        .map((point, index) => {
          const prefix = index === 0 ? "M" : "L";
          return `${prefix} ${formatNumber(point.x - bounds.minX)} ${formatNumber(point.y - bounds.minY)}`;
        })
        .join(" "),
    )
    .join(" ");

  return {
    kind: "node",
    id,
    shape: "path",
    label: "",
    pathData,
    x: bounds.minX,
    y: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
    style: buildStrokeStyle(props, settings, "none"),
  };
}

function createCircleNode(
  id: string,
  center: Point2D,
  radius: number,
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
): ASTNode {
  return {
    kind: "node",
    id,
    shape: "circle",
    label: "",
    x: center.x - radius,
    y: center.y - radius,
    width: radius * 2,
    height: radius * 2,
    style: buildCircleStyle(props, settings),
  };
}

function createTextNode(
  id: string,
  label: string,
  position: Point2D,
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
  meta?: Record<string, string>,
): ASTNode {
  return {
    kind: "node",
    id,
    shape: "text",
    label,
    x: position.x,
    y: position.y,
    style: buildTextStyle(props, settings),
    ...(meta ? { meta } : {}),
  };
}

function buildStrokeStyle(
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
  fillFallback: string,
): StyleProps {
  const style = parseStyleProps(props);
  style.stroke = props.stroke ?? style.stroke ?? settings.color;
  style.strokeWidth = style.strokeWidth ?? settings.strokeWidth;
  style.fill = props.fill ?? style.fill ?? fillFallback;
  return style;
}

function buildCircleStyle(
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
): StyleProps {
  const style = parseStyleProps(props);
  style.fill = props.fill ?? style.fill ?? props.stroke ?? settings.color;
  style.stroke = props.stroke ?? style.stroke ?? props.fill ?? settings.color;
  style.strokeWidth = style.strokeWidth ?? 1;
  return style;
}

function buildTextStyle(
  props: Record<string, string>,
  settings: Required<AnnotationPluginOptions>,
): StyleProps {
  const style = parseStyleProps(props);
  style.color = props.color ?? style.color ?? props.stroke ?? settings.color;
  return style;
}

function parseStyleProps(props: Record<string, string>): StyleProps {
  const style: StyleProps = {};

  if (props.fill) style.fill = props.fill;
  if (props.stroke) style.stroke = props.stroke;
  if (props["stroke-width"]) style.strokeWidth = parseFloat(props["stroke-width"]);
  if (props.color) style.color = props.color;
  if (props.opacity) style.opacity = parseFloat(props.opacity);
  if (props["font-size"]) style.fontSize = parseFloat(props["font-size"]);
  if (props["font-weight"]) style.fontWeight = props["font-weight"];
  if (props["text-align"]) style.textAlign = props["text-align"] as StyleProps["textAlign"];
  if (props["vertical-align"]) {
    style.verticalAlign = props["vertical-align"] as StyleProps["verticalAlign"];
  }
  if (props["line-height"]) style.lineHeight = parseFloat(props["line-height"]);
  if (props["letter-spacing"]) style.letterSpacing = parseFloat(props["letter-spacing"]);
  if (props.font) style.font = props.font;

  const dashValue = props.dash ?? props["stroke-dash"];
  if (dashValue) {
    const parts = dashValue
      .split(",")
      .map(Number)
      .filter((value) => !Number.isNaN(value));
    if (parts.length) style.strokeDash = parts;
  }

  return style;
}

function assertUnusedId(id: string, usedIds: ReadonlySet<string>, lineNumber: number): void {
  if (usedIds.has(id)) {
    throw new Error(`Annotation id "${id}" on line ${lineNumber} conflicts with an existing node id`);
  }
}

function helperLabelId(id: string, usedIds: ReadonlySet<string>, lineNumber: number): string {
  const helperId = `__annot_${sanitizeId(id)}_label`;
  assertUnusedId(helperId, usedIds, lineNumber);
  return helperId;
}

function boundsOf(points: readonly Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function absolutizePath(path: string, minX: number, minY: number): string {
  return path
    .replace(/A\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([01])\s+([01])\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_match, rx, ry, rotation, largeArc, sweep, x, y) => (
      `A ${rx} ${ry} ${rotation} ${largeArc} ${sweep} ${formatNumber(Number(x) - minX)} ${formatNumber(Number(y) - minY)}`
    ))
    .replace(/([MLQ])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?))?(?:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?))?/g, (match, command, x1, y1, x2, y2) => {
      if (command === "M" || command === "L") {
        return `${command} ${formatNumber(Number(x1) - minX)} ${formatNumber(Number(y1) - minY)}`;
      }
      if (command === "Q") {
        return `${command} ${formatNumber(Number(x1) - minX)} ${formatNumber(Number(y1) - minY)} ${formatNumber(Number(x2) - minX)} ${formatNumber(Number(y2) - minY)}`;
      }
      return match;
    });
}

function buildOffsets(count: number, spacing: number): number[] {
  const offsets: number[] = [];
  for (let index = 0; index < count; index += 1) {
    offsets.push((index - (count - 1) / 2) * spacing);
  }
  return offsets;
}

function subtract(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(point: Point2D, amount: number): Point2D {
  return { x: point.x * amount, y: point.y * amount };
}

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function normalize(point: Point2D, lineNumber: number, id: string): Point2D {
  const length = Math.hypot(point.x, point.y);
  if (!length) {
    throw new Error(`Annotation "${id}" on line ${lineNumber} requires distinct points`);
  }
  return {
    x: point.x / length,
    y: point.y / length,
  };
}

function pickBisector(
  a: Point2D,
  b: Point2D,
  invert = false,
): Point2D {
  const sum = { x: a.x + b.x, y: a.y + b.y };
  const length = Math.hypot(sum.x, sum.y);
  if (length > 1e-6) {
    const interior = {
      x: sum.x / length,
      y: sum.y / length,
    };
    return invert
      ? { x: -interior.x, y: -interior.y }
      : interior;
  }
  return preferredNormal(a, invert);
}

function parseAngleMode(value: string | undefined, lineNumber: number): AngleMode {
  if (!value) return "interior";

  switch (value.toLowerCase()) {
    case "interior":
    case "reflex":
      return value.toLowerCase() as AngleMode;
    default:
      throw new Error(`Invalid angle mode "${value}" on line ${lineNumber}; expected interior or reflex`);
  }
}

function buildAngleArcGeometry(
  center: Point2D,
  u1: Point2D,
  u2: Point2D,
  radius: number,
  mode: Exclude<AngleMode, "interior">,
): ArcGeometry {
  const startDirection = u1;
  const endDirection = u2;
  const startAngle = directionAngle(startDirection);
  const sweep = desiredArcSweep(startDirection, endDirection, mode === "reflex");
  const endAngle = startAngle + sweep;
  const start = add(center, scale(startDirection, radius));
  const end = add(center, scale(directionFromAngle(endAngle), radius));
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;

  return {
    path: `M ${formatNumber(start.x)} ${formatNumber(start.y)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 ${largeArc} ${sweepFlag} ${formatNumber(end.x)} ${formatNumber(end.y)}`,
    points: sampleArcPoints(center, radius, startAngle, sweep),
    labelDirection: directionFromAngle(startAngle + sweep / 2),
  };
}

function desiredArcSweep(startDirection: Point2D, endDirection: Point2D, major: boolean): number {
  const startAngle = directionAngle(startDirection);
  const endAngle = directionAngle(endDirection);
  const minorSweep = normalizeAngle(endAngle - startAngle);

  if (!major) return minorSweep;
  if (minorSweep === 0) return Math.PI * 2;
  return minorSweep > 0 ? minorSweep - Math.PI * 2 : minorSweep + Math.PI * 2;
}

function sampleArcPoints(
  center: Point2D,
  radius: number,
  startAngle: number,
  sweep: number,
): Point2D[] {
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 8)));
  const points: Point2D[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const angle = startAngle + (sweep * step) / steps;
    points.push(add(center, scale(directionFromAngle(angle), radius)));
  }

  return points;
}

function directionAngle(direction: Point2D): number {
  return Math.atan2(direction.y, direction.x);
}

function directionFromAngle(angle: number): Point2D {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += Math.PI * 2;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function angleControlDistance(
  center: Point2D,
  start: Point2D,
  end: Point2D,
  bisector: Point2D,
  radius: number,
  invert: boolean,
): number {
  const chordMidpoint = lerp(start, end, 0.5);
  const midpointDistance = projectionDistance(subtract(chordMidpoint, center), bisector);
  const bulge = Math.max(radius - midpointDistance, radius * 0.18);

  if (invert) {
    return Math.max(radius * 0.28, midpointDistance - bulge);
  }

  return midpointDistance + bulge;
}

function projectionDistance(point: Point2D, direction: Point2D): number {
  return point.x * direction.x + point.y * direction.y;
}

function preferredNormal(unit: Point2D, invert = false): Point2D {
  const normalA = { x: unit.y, y: -unit.x };
  const normalB = { x: -unit.y, y: unit.x };
  const chosen = normalScore(normalA) >= normalScore(normalB) ? normalA : normalB;
  return invert ? { x: -chosen.x, y: -chosen.y } : chosen;
}

function normalScore(normal: Point2D): number {
  let score = 0;
  if (normal.y < 0) score += 2;
  if (Math.abs(normal.x) > 0.6) score += 1;
  if (normal.x > 0) score += 0.25;
  return score;
}

function parseInvert(value: string | undefined): boolean {
  if (!value) return false;
  switch (value.toLowerCase()) {
    case "true":
    case "1":
    case "yes":
    case "on":
      return true;
    default:
      return false;
  }
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function readNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
