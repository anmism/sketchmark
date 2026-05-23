import type {
  ArcElement,
  CircleElement,
  CuboidElement,
  CurveElement,
  EllipseElement,
  GroupElement,
  ImageElement,
  KernelElement,
  KernelPathElement,
  LightElement,
  Line3dElement,
  LineElement,
  PathElement,
  PlaneElement,
  PointElement,
  PolygonElement,
  PolylineElement,
  RectElement,
  SphereElement,
  Text3dElement,
  TextElement
} from "../types";
import { clone } from "../utils";
import { cloneOptional, common2d, common3d, meshElement, toPath } from "./common";
import { arcPath, circlePath, cuboidGeometry, curvePath, ellipsePath, linePath, planeGeometry, point2, pointsPath, roundedRectPath, sphereGeometry } from "./geometry";
import type { ShapeDefinition, ShapeValidationContext } from "./types";

const STYLE_ANIMATABLE = ["opacity", "fill", "stroke", "strokeWidth", "dashOffset", "drawStart", "drawEnd", "rotation", "scale", "scaleX", "scaleY"];
const THREE_ANIMATABLE = ["opacity", "fill", "stroke", "strokeWidth", "positionX", "positionY", "positionZ", "rotationX", "rotationY", "rotationZ", "scale", "scaleX", "scaleY", "scaleZ"];
const numberProperty = { type: "number" };
const stringProperty = { type: "string" };
const point2Property = { $ref: "#/$defs/point2" };
const endpointProperty = { $ref: "#/$defs/endpoint" };

export const builtInShapeLowerers: ShapeDefinition[] = [
  {
    type: "rect",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "x", "y", "width", "height"],
    schema: { properties: { x: numberProperty, y: numberProperty, width: numberProperty, height: numberProperty } },
    validateGeometry(element, context) {
      const item = element as RectElement;
      context.requireNumber(item.x, `${context.path}/x`);
      context.requireNumber(item.y, `${context.path}/y`);
      context.requireNumber(item.width, `${context.path}/width`);
      context.requireNumber(item.height, `${context.path}/height`);
    },
    lower(element) {
      const item = element as RectElement;
      return toPath(item, roundedRectPath(item.x, item.y, item.width, item.height, Number(item.radius ?? 0)));
    }
  },
  {
    type: "circle",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "cx", "cy", "radius"],
    schema: { properties: { cx: numberProperty, cy: numberProperty, radius: numberProperty } },
    validateGeometry(element, context) {
      const item = element as CircleElement;
      if (!item.follow) {
        context.requireNumber(item.cx, `${context.path}/cx`);
        context.requireNumber(item.cy, `${context.path}/cy`);
      }
      context.requireNumber(item.radius, `${context.path}/radius`);
    },
    validateReferences(element, context) {
      const item = element as CircleElement;
      if (!item.follow) return;
      const followed = context.ids.get(item.follow);
      if (!followed) {
        context.addIssue(`${context.path}/follow`, "unknown_follow_target", `Unknown follow target '${item.follow}'.`);
      } else if (!context.isFollowable(followed.type)) {
        context.addIssue(`${context.path}/follow`, "invalid_follow_target", `Element '${item.follow}' is not a line, arrow, arc, curve, path, polyline, or polygon.`);
      }
    },
    lower(element) {
      const item = element as CircleElement;
      return toPath(item, circlePath(Number(item.cx ?? 0), Number(item.cy ?? 0), item.radius));
    }
  },
  {
    type: "ellipse",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "cx", "cy", "rx", "ry"],
    schema: { properties: { cx: numberProperty, cy: numberProperty, rx: numberProperty, ry: numberProperty } },
    validateGeometry(element, context) {
      const item = element as EllipseElement;
      context.requireNumber(item.cx, `${context.path}/cx`);
      context.requireNumber(item.cy, `${context.path}/cy`);
      context.requireNumber(item.rx, `${context.path}/rx`);
      context.requireNumber(item.ry, `${context.path}/ry`);
    },
    lower(element) {
      const item = element as EllipseElement;
      return toPath(item, ellipsePath(item.cx, item.cy, item.rx, item.ry));
    }
  },
  {
    type: "line",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { from: endpointProperty, to: endpointProperty } },
    validateGeometry(element, context) {
      const item = element as LineElement;
      if (item.from === undefined) context.addIssue(`${context.path}/from`, "missing_from", "Line/arrow from is required.");
      if (item.to === undefined) context.addIssue(`${context.path}/to`, "missing_to", "Line/arrow to is required.");
    },
    validateReferences(element, context) {
      const item = element as LineElement;
      context.validateEndpoint(item.from, `${context.path}/from`);
      context.validateEndpoint(item.to, `${context.path}/to`);
    },
    lower(element) {
      const item = element as LineElement;
      return toPath(item, linePath(point2(item.from), point2(item.to)), { fill: "none", stroke: item.stroke ?? "#111827" });
    }
  },
  {
    type: "arrow",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { from: endpointProperty, to: endpointProperty } },
    validateGeometry(element, context) {
      const item = element as LineElement;
      if (item.from === undefined) context.addIssue(`${context.path}/from`, "missing_from", "Line/arrow from is required.");
      if (item.to === undefined) context.addIssue(`${context.path}/to`, "missing_to", "Line/arrow to is required.");
    },
    validateReferences(element, context) {
      const item = element as LineElement;
      context.validateEndpoint(item.from, `${context.path}/from`);
      context.validateEndpoint(item.to, `${context.path}/to`);
    },
    lower(element) {
      const item = element as LineElement;
      return toPath(item, linePath(point2(item.from), point2(item.to)), {
        fill: "none",
        stroke: item.stroke ?? "#111827",
        metadata: { ...(item.metadata ?? {}), markerEnd: "arrow" }
      });
    }
  },
  {
    type: "arc",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "startAngle", "endAngle"],
    followable: true,
    schema: { properties: { cx: numberProperty, cy: numberProperty, radius: numberProperty, startAngle: numberProperty, endAngle: numberProperty, counterclockwise: { type: "boolean" }, closed: { type: "boolean" } } },
    validateGeometry(element, context) {
      const item = element as ArcElement;
      context.requireNumber(item.cx, `${context.path}/cx`);
      context.requireNumber(item.cy, `${context.path}/cy`);
      context.requireNumber(item.radius, `${context.path}/radius`);
      context.requireNumber(item.startAngle, `${context.path}/startAngle`);
      context.requireNumber(item.endAngle, `${context.path}/endAngle`);
    },
    lower(element) {
      const item = element as ArcElement;
      return toPath(item, arcPath(item.cx, item.cy, item.radius, item.startAngle, item.endAngle, Boolean(item.counterclockwise), Boolean(item.closed)), {
        fill: item.closed ? item.fill : "none"
      });
    }
  },
  {
    type: "curve",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { from: endpointProperty, to: endpointProperty, control1: point2Property, control2: point2Property } },
    validateGeometry(element, context) {
      const item = element as CurveElement;
      if (item.from === undefined) context.addIssue(`${context.path}/from`, "missing_from", "Curve from is required.");
      if (item.to === undefined) context.addIssue(`${context.path}/to`, "missing_to", "Curve to is required.");
      context.requirePoint2(item.control1, `${context.path}/control1`, "missing_control1", "Curve control1 must be [x,y].");
      if (item.control2 !== undefined) context.requirePoint2(item.control2, `${context.path}/control2`, "invalid_control2", "Curve control2 must be [x,y].");
    },
    validateReferences(element, context) {
      const item = element as CurveElement;
      context.validateEndpoint(item.from, `${context.path}/from`);
      context.validateEndpoint(item.to, `${context.path}/to`);
    },
    lower(element) {
      const item = element as CurveElement;
      return toPath(item, curvePath(point2(item.from), item.control1, item.control2, point2(item.to)), { fill: item.fill ?? "none" });
    }
  },
  {
    type: "polyline",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { points: { type: "array", items: point2Property } } },
    validateGeometry(element, context) {
      const item = element as PolylineElement;
      context.requirePoint2Array(item.points, 2, `${context.path}/points`, "missing_points", "Polyline points must contain at least two [x,y] points.");
    },
    lower(element) {
      const item = element as PolylineElement;
      return toPath(item, pointsPath(item.points, false), { fill: "none" });
    }
  },
  {
    type: "polygon",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { points: { type: "array", items: point2Property } } },
    validateGeometry(element, context) {
      const item = element as PolygonElement;
      context.requirePoint2Array(item.points, 3, `${context.path}/points`, "missing_points", "Polygon points must contain at least three [x,y] points.");
    },
    lower(element) {
      const item = element as PolygonElement;
      return toPath(item, pointsPath(item.points, true));
    }
  },
  {
    type: "path",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE],
    followable: true,
    schema: { properties: { d: stringProperty } },
    validateGeometry(element, context) {
      const item = element as PathElement;
      if (typeof item.d !== "string" || !item.d.trim()) context.addIssue(`${context.path}/d`, "missing_path_d", "Path d is required.");
    },
    lower(element) {
      const item = element as PathElement;
      return { ...(common2d(item) as Omit<KernelPathElement, "type" | "d">), type: "path", d: item.d };
    }
  },
  {
    type: "text",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "x", "y"],
    schema: { properties: { x: numberProperty, y: numberProperty, text: stringProperty, lines: { type: "array", items: stringProperty } } },
    validateGeometry(element, context) {
      const item = element as TextElement;
      context.requireNumber(item.x, `${context.path}/x`);
      context.requireNumber(item.y, `${context.path}/y`);
      if (typeof item.text !== "string" && !Array.isArray(item.lines)) context.addIssue(`${context.path}/text`, "missing_text", "Text content is required. Use text or lines.");
      if (item.lines !== undefined && (!Array.isArray(item.lines) || item.lines.some((line) => typeof line !== "string"))) {
        context.addIssue(`${context.path}/lines`, "invalid_text_lines", "Text lines must be an array of strings.");
      }
    },
    validateWarnings(element, context) {
      const item = element as TextElement;
      const lines = Array.isArray(item.lines) && item.lines.length ? item.lines : String(item.text ?? "").split(/\r?\n/);
      const text = lines.join("\n");
      if (text.length > 42 && !item.maxWidth && !item.wrap && !item.fit) {
        context.addWarning(`${context.path}/text`, "long_text_no_wrap", "Long text does not resize or wrap automatically.", "Set maxWidth, wrap, or fit explicitly.");
      }
    },
    lower(element) {
      const item = element as TextElement;
      return {
        ...(common2d(item) as Omit<KernelElement, "type">),
        type: "text",
        x: item.x,
        y: item.y,
        text: item.text,
        lines: cloneOptional(item.lines),
        align: item.align,
        valign: item.valign,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
        weight: item.weight,
        fontStyle: item.fontStyle,
        lineHeight: item.lineHeight,
        letterSpacing: item.letterSpacing,
        maxWidth: item.maxWidth,
        wrap: item.wrap,
        fit: item.fit
      } as KernelElement;
    }
  },
  {
    type: "image",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "x", "y", "width", "height"],
    schema: { properties: { src: stringProperty, x: numberProperty, y: numberProperty, width: numberProperty, height: numberProperty, fit: { $ref: "#/$defs/imageFit" }, source: { $ref: "#/$defs/imageSource" } } },
    validateGeometry(element, context) {
      const item = element as ImageElement;
      context.requireNumber(item.x, `${context.path}/x`);
      context.requireNumber(item.y, `${context.path}/y`);
      context.requireNumber(item.width, `${context.path}/width`);
      context.requireNumber(item.height, `${context.path}/height`);
      if (typeof item.src !== "string") context.addIssue(`${context.path}/src`, "missing_src", "Image src is required.");
      context.validateImageOptions(item);
    },
    lower(element) {
      const item = element as ImageElement;
      return {
        ...(common2d(item) as Omit<KernelElement, "type">),
        type: "image",
        src: item.src,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        fit: item.fit,
        source: cloneOptional(item.source)
      } as KernelElement;
    }
  },
  {
    type: "point",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "x", "y"],
    schema: { properties: { x: numberProperty, y: numberProperty } },
    validateGeometry(element, context) {
      const item = element as PointElement;
      context.requireNumber(item.x, `${context.path}/x`);
      context.requireNumber(item.y, `${context.path}/y`);
    },
    lower(element) {
      const item = element as PointElement;
      return { ...(common2d(item) as Omit<KernelElement, "type">), type: "point", x: item.x, y: item.y } as KernelElement;
    }
  },
  {
    type: "group",
    kind: "2d",
    animatable: [...STYLE_ANIMATABLE, "x", "y"],
    schema: { properties: { x: numberProperty, y: numberProperty, children: { type: "array", items: { $ref: "#/$defs/element" } } } },
    validateGeometry(element, context) {
      const item = element as GroupElement;
      context.requireNumber(item.x, `${context.path}/x`);
      context.requireNumber(item.y, `${context.path}/y`);
      if (!Array.isArray(item.children)) context.addIssue(`${context.path}/children`, "missing_group_children", "Group children must be an array.");
    },
    lower(element, context) {
      const item = element as GroupElement;
      return {
        ...(common2d(item) as Omit<KernelElement, "type">),
        type: "group",
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        children: context.lowerElements(item.children ?? [])
      } as KernelElement;
    }
  },
  {
    type: "cuboid",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE],
    schema: { properties: { position: { $ref: "#/$defs/point3" }, size: { $ref: "#/$defs/point3" } } },
    validateGeometry(element, context) {
      const item = element as CuboidElement;
      context.requirePoint3(item.position, `${context.path}/position`, "missing_position", "Cuboid position must be [x,y,z].");
      context.requirePoint3(item.size, `${context.path}/size`, "missing_size", "Cuboid size must be [width,height,depth].");
    },
    lower(element) {
      const item = element as CuboidElement;
      const geometry = cuboidGeometry(item.size);
      return meshElement(item, geometry.vertices, geometry.faces, clone(item.position));
    }
  },
  {
    type: "sphere",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE],
    schema: { properties: { position: { $ref: "#/$defs/point3" }, radius: numberProperty } },
    validateGeometry(element, context) {
      const item = element as SphereElement;
      context.requirePoint3(item.position, `${context.path}/position`, "missing_position", "Sphere position must be [x,y,z].");
      context.requireNumber(item.radius, `${context.path}/radius`);
    },
    lower(element) {
      const item = element as SphereElement;
      const geometry = sphereGeometry(item.radius);
      return meshElement(item, geometry.vertices, geometry.faces, clone(item.position));
    }
  },
  {
    type: "plane",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE],
    schema: { properties: { position: { $ref: "#/$defs/point3" }, size: point2Property } },
    validateGeometry(element, context) {
      const item = element as PlaneElement;
      context.requirePoint3(item.position, `${context.path}/position`, "missing_position", "Plane position must be [x,y,z].");
      context.requirePoint2(item.size, `${context.path}/size`, "missing_size", "Plane size must be [width,height].");
    },
    lower(element) {
      const item = element as PlaneElement;
      const geometry = planeGeometry(item.size);
      return meshElement(item, geometry.vertices, geometry.faces, clone(item.position));
    }
  },
  {
    type: "line3d",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE],
    schema: { properties: { from: { $ref: "#/$defs/point3" }, to: { $ref: "#/$defs/point3" } } },
    validateGeometry(element, context) {
      const item = element as Line3dElement;
      context.requirePoint3(item.from, `${context.path}/from`, "missing_from", "line3d from must be [x,y,z].");
      context.requirePoint3(item.to, `${context.path}/to`, "missing_to", "line3d to must be [x,y,z].");
    },
    lower(element) {
      const item = element as Line3dElement;
      return { ...(common3d(item) as Omit<KernelElement, "type">), type: "line3d", from: clone(item.from), to: clone(item.to) } as KernelElement;
    }
  },
  {
    type: "text3d",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE],
    schema: { properties: { text: stringProperty, position: { $ref: "#/$defs/point3" } } },
    validateGeometry(element, context) {
      const item = element as Text3dElement;
      if (typeof item.text !== "string") context.addIssue(`${context.path}/text`, "missing_text", "text3d text is required.");
      context.requirePoint3(item.position, `${context.path}/position`, "missing_position", "text3d position must be [x,y,z].");
    },
    lower(element) {
      const item = element as Text3dElement;
      return { ...(common3d(item) as Omit<KernelElement, "type">), type: "text3d", text: item.text, position: clone(item.position), fontSize: item.fontSize } as KernelElement;
    }
  },
  {
    type: "light",
    kind: "3d",
    animatable: [...THREE_ANIMATABLE, "intensity"],
    schema: { properties: { kind: { enum: ["ambient", "directional", "point"] }, position: { $ref: "#/$defs/point3" }, intensity: numberProperty } },
    validateGeometry() {
      // Light position is optional for ambient lights and currently permissive for all light kinds.
    },
    lower(element) {
      const item = element as LightElement;
      return { ...(common3d(item) as Omit<KernelElement, "type">), type: "light", kind: item.kind, position: cloneOptional(item.position), intensity: item.intensity } as KernelElement;
    }
  }
];
