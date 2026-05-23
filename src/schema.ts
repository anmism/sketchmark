import { registeredAuthoringShapeDefinitions } from "./shapes";

export type JsonSchema = Record<string, unknown>;

export function generateVisualSchema(): JsonSchema {
  const shapeDefinitions = registeredAuthoringShapeDefinitions();
  const elementProperties: JsonSchema = {
    id: { type: "string" },
    type: { enum: shapeDefinitions.map((definition) => definition.type) },
    opacity: { type: "number" },
    fill: { $ref: "#/$defs/paint" },
    stroke: { $ref: "#/$defs/paint" },
    strokeWidth: { type: "number" },
    dashArray: { type: "array", items: { type: "number" } },
    strokeCap: { enum: ["butt", "round", "square"] },
    strokeJoin: { enum: ["miter", "round", "bevel"] },
    miterLimit: { type: "number" },
    dashOffset: { type: "number" },
    drawStart: { type: "number" },
    drawEnd: { type: "number" },
    effects: { $ref: "#/$defs/effects" },
    blendMode: { type: "string" },
    rotation: { type: "number" },
    scale: { type: "number" },
    scaleX: { type: "number" },
    scaleY: { type: "number" },
    origin: { oneOf: [{ type: "string" }, { $ref: "#/$defs/point2" }] },
    clip: { $ref: "#/$defs/clipShape" },
    mask: { $ref: "#/$defs/clipShape" },
    animate: { type: "object", additionalProperties: { $ref: "#/$defs/animationValue" } },
    metadata: { type: "object", additionalProperties: true },
    align: { enum: ["left", "center", "right"] },
    valign: { enum: ["top", "middle", "bottom"] },
    fontSize: { type: "number" },
    fontFamily: { type: "string" },
    weight: { oneOf: [{ type: "number" }, { type: "string" }] },
    fontStyle: { type: "string" },
    lineHeight: { type: "number" },
    letterSpacing: { type: "number" },
    maxWidth: { type: "number" },
    wrap: { type: "boolean" },
    label: { type: "string" },
    labelX: { type: "number" },
    labelY: { type: "number" },
    progress: { oneOf: [{ type: "number" }, { $ref: "#/$defs/animationValue" }] },
    follow: { type: "string" },
    rotationX: { type: "number" },
    rotationY: { type: "number" },
    rotationZ: { type: "number" },
    scaleZ: { type: "number" }
  };

  for (const definition of shapeDefinitions) {
    for (const [key, value] of Object.entries(definition.schema?.properties ?? {})) {
      elementProperties[key] = mergeSchemaProperty(elementProperties[key], value);
    }
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sketchmark.dev/schema/visual.schema.json",
    title: "Sketchmark Primitive Visual Document",
    type: "object",
    required: ["version", "canvas"],
    additionalProperties: true,
    properties: {
      version: { const: 1 },
      canvas: {
        type: "object",
        required: ["width", "height"],
        additionalProperties: true,
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          background: { type: "string" },
          duration: { type: "number" },
          fps: { type: "number" },
          space: { enum: ["2d", "3d"] },
          renderer: { enum: ["svg", "three"] }
        }
      },
      elements: {
        type: "array",
        items: { $ref: "#/$defs/element" }
      },
      imports: {
        type: "object",
        additionalProperties: { type: "string" }
      },
      assets: {
        type: "object",
        additionalProperties: { type: "string" }
      },
      exports: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            format: { enum: ["svg", "html", "png", "jpg", "mp4", "webm", "pdf", "pptx"] },
            sequence: { type: "string" },
            scene: { type: "string" }
          },
          additionalProperties: true
        }
      },
      scenes: {
        type: "object",
        additionalProperties: {
          type: "object",
          required: ["elements"],
          properties: {
            canvas: { type: "object" },
            elements: {
              type: "array",
              items: { $ref: "#/$defs/element" }
            },
            steps: {
              type: "array",
              items: { $ref: "#/$defs/deckStep" }
            }
          },
          additionalProperties: true
        }
      },
      sequences: {
        type: "object",
        additionalProperties: {
          type: "object",
          required: ["id", "clips"],
          properties: {
            id: { type: "string" },
            clips: {
              type: "array",
              items: { $ref: "#/$defs/clip" }
            }
          },
          additionalProperties: true
        }
      }
    },
    $defs: {
      point2: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: { type: "number" }
      },
      point3: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "number" }
      },
      endpoint: {
        oneOf: [{ $ref: "#/$defs/point2" }, { type: "string" }]
      },
      paint: paintSchema(),
      imageFit: {
        enum: ["fill", "contain", "cover"]
      },
      gradientStops: gradientStopsSchema(),
      effects: effectsSchema(),
      clipShape: clipShapeSchema(),
      imageSource: {
        type: "object",
        required: ["x", "y", "width", "height", "imageWidth", "imageHeight"],
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          imageWidth: { type: "number" },
          imageHeight: { type: "number" }
        },
        additionalProperties: true
      },
      animationValue: {
        type: "object",
        additionalProperties: true,
        properties: {
          from: { oneOf: [{ type: "number" }, { type: "string" }] },
          to: { oneOf: [{ type: "number" }, { type: "string" }] },
          duration: { type: "number" },
          delay: { type: "number" },
          ease: { type: "string" },
          keyframes: {
            type: "array",
            items: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              prefixItems: [{ type: "number" }, { oneOf: [{ type: "number" }, { type: "string" }] }]
            }
          }
        }
      },
      clip: {
        type: "object",
        required: ["scene", "duration"],
        properties: {
          scene: { type: "string" },
          duration: { type: "number" },
          transition: {
            oneOf: [
              { enum: ["cut", "fade"] },
              {
                type: "object",
                required: ["type"],
                properties: {
                  type: { enum: ["cut", "fade"] },
                  duration: { type: "number" }
                },
                additionalProperties: true
              }
            ]
          }
        },
        additionalProperties: true
      },
      deckStep: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          show: { type: "array", items: { type: "string" } },
          hide: { type: "array", items: { type: "string" } },
          duration: { type: "number" }
        },
        additionalProperties: true
      },
      element: {
        type: "object",
        required: ["type"],
        additionalProperties: true,
        properties: elementProperties
      }
    }
  };
}

function mergeSchemaProperty(existing: unknown, incoming: unknown): unknown {
  if (existing === undefined) return incoming;
  if (schemaKey(existing) === schemaKey(incoming)) return existing;
  const items = schemaAlternatives(existing);
  const incomingItems = schemaAlternatives(incoming);
  for (const item of incomingItems) {
    if (!items.some((existingItem) => schemaKey(existingItem) === schemaKey(item))) items.push(item);
  }
  return { oneOf: items };
}

function schemaAlternatives(value: unknown): unknown[] {
  if (value && typeof value === "object" && Array.isArray((value as { oneOf?: unknown }).oneOf)) {
    return [...((value as { oneOf: unknown[] }).oneOf)];
  }
  return [value];
}

function schemaKey(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
}

function paintSchema(): JsonSchema {
  return {
    oneOf: [
      { type: "string" },
      {
        type: "object",
        required: ["type", "from", "to", "stops"],
        properties: {
          type: { const: "linearGradient" },
          from: { $ref: "#/$defs/point2" },
          to: { $ref: "#/$defs/point2" },
          stops: { $ref: "#/$defs/gradientStops" }
        },
        additionalProperties: true
      },
      {
        type: "object",
        required: ["type", "center", "radius", "stops"],
        properties: {
          type: { const: "radialGradient" },
          center: { $ref: "#/$defs/point2" },
          radius: { type: "number" },
          focus: { $ref: "#/$defs/point2" },
          stops: { $ref: "#/$defs/gradientStops" }
        },
        additionalProperties: true
      },
      {
        type: "object",
        required: ["type", "src", "width", "height"],
        properties: {
          type: { const: "pattern" },
          src: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          fit: { $ref: "#/$defs/imageFit" },
          opacity: { type: "number" }
        },
        additionalProperties: true
      }
    ]
  };
}

function gradientStopsSchema(): JsonSchema {
  return {
    type: "array",
    minItems: 2,
    items: {
      oneOf: [
        {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [{ type: "number" }, { type: "string" }]
        },
        {
          type: "object",
          required: ["offset", "color"],
          properties: {
            offset: { type: "number" },
            color: { type: "string" }
          },
          additionalProperties: true
        }
      ]
    }
  };
}

function effectsSchema(): JsonSchema {
  return {
    type: "object",
    properties: {
      blur: { type: "number" },
      brightness: { type: "number" },
      contrast: { type: "number" },
      saturate: { type: "number" },
      hueRotate: { type: "number" },
      shadow: {
        type: "object",
        required: ["dx", "dy", "blur", "color"],
        properties: {
          dx: { type: "number" },
          dy: { type: "number" },
          blur: { type: "number" },
          color: { type: "string" },
          opacity: { type: "number" }
        },
        additionalProperties: true
      }
    },
    additionalProperties: true
  };
}

function clipShapeSchema(): JsonSchema {
  return {
    oneOf: [
      {
        type: "object",
        required: ["type", "x", "y", "width", "height"],
        properties: {
          type: { const: "rect" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          radius: { type: "number" },
          opacity: { type: "number" }
        },
        additionalProperties: true
      },
      {
        type: "object",
        required: ["type", "cx", "cy", "radius"],
        properties: {
          type: { const: "circle" },
          cx: { type: "number" },
          cy: { type: "number" },
          radius: { type: "number" },
          opacity: { type: "number" }
        },
        additionalProperties: true
      },
      {
        type: "object",
        required: ["type", "d"],
        properties: {
          type: { const: "path" },
          d: { type: "string" },
          opacity: { type: "number" }
        },
        additionalProperties: true
      }
    ]
  };
}
