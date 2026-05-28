export type JsonSchema = Record<string, unknown>;

export function generateVisualSchema(): JsonSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sketchmark.dev/schema/visual.schema.json",
    title: "Sketchmark Render Kernel Document",
    type: "object",
    required: ["version", "canvas"],
    additionalProperties: false,
    properties: {
      version: { const: 1 },
      canvas: {
        type: "object",
        required: ["width", "height"],
        additionalProperties: false,
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          background: { type: "string" },
          duration: { type: "number", minimum: 0 },
          fps: { type: "number", exclusiveMinimum: 0 }
        }
      },
      elements: {
        type: "array",
        items: { $ref: "#/$defs/element" }
      }
    },
    $defs: {
      point2: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [{ type: "number" }, { type: "number" }]
      },
      gradientStop: {
        oneOf: [
          {
            type: "array",
            minItems: 2,
            maxItems: 2,
            prefixItems: [{ type: "number", minimum: 0, maximum: 1 }, { type: "string" }]
          },
          {
            type: "object",
            required: ["offset", "color"],
            additionalProperties: false,
            properties: {
              offset: { type: "number", minimum: 0, maximum: 1 },
              color: { type: "string" }
            }
          }
        ]
      },
      paint: paintSchema(),
      effects: effectsSchema(),
      imageFit: { enum: ["fill", "contain", "cover"] },
      imageSource: {
        type: "object",
        required: ["x", "y", "width", "height", "imageWidth", "imageHeight"],
        additionalProperties: false,
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          imageWidth: { type: "number" },
          imageHeight: { type: "number" }
        }
      },
      clipShape: {
        type: "object",
        required: ["type", "d"],
        additionalProperties: false,
        properties: {
          type: { const: "path" },
          d: { type: "string" }
        }
      },
      maskShape: {
        type: "object",
        required: ["type", "d"],
        additionalProperties: false,
        properties: {
          type: { const: "path" },
          d: { type: "string" },
          opacity: { type: "number", minimum: 0, maximum: 1 }
        }
      },
      timelineValue: {
        oneOf: [
          { type: "number" },
          { type: "string" },
          { type: "array", items: { type: "number" } },
          { type: "array", items: { type: "string" } },
          { type: "object", additionalProperties: true }
        ]
      },
      timelineCurve: {
        oneOf: [
          {
            type: "object",
            required: ["type", "points"],
            additionalProperties: false,
            properties: {
              type: { const: "graph" },
              points: {
                type: "array",
                minItems: 2,
                items: { $ref: "#/$defs/point2" }
              }
            }
          },
          {
            type: "object",
            required: ["type", "x1", "y1", "x2", "y2"],
            additionalProperties: false,
            properties: {
              type: { const: "cubicBezier" },
              x1: { type: "number", minimum: 0, maximum: 1 },
              y1: { type: "number" },
              x2: { type: "number", minimum: 0, maximum: 1 },
              y2: { type: "number" }
            }
          },
          {
            type: "object",
            required: ["type"],
            additionalProperties: false,
            properties: {
              type: { const: "hold" }
            }
          }
        ]
      },
      timelineKeyframe: {
        oneOf: [
          {
            type: "array",
            minItems: 2,
            maxItems: 2,
            prefixItems: [{ type: "number" }, { $ref: "#/$defs/timelineValue" }]
          },
          {
            type: "object",
            required: ["time", "value"],
            additionalProperties: false,
            properties: {
              time: { type: "number" },
              value: { $ref: "#/$defs/timelineValue" },
              in: { $ref: "#/$defs/timelineCurve" },
              out: { $ref: "#/$defs/timelineCurve" },
              interpolation: { $ref: "#/$defs/timelineCurve" }
            }
          }
        ]
      },
      timelineTrack: {
        type: "object",
        required: ["keyframes"],
        additionalProperties: false,
        properties: {
          curve: { $ref: "#/$defs/timelineCurve" },
          ease: { type: "string" },
          keyframes: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/timelineKeyframe" }
          }
        }
      },
      timeline: {
        type: "object",
        additionalProperties: false,
        properties: {
          start: { type: "number", minimum: 0 },
          end: { type: "number", minimum: 0 },
          tracks: {
            type: "object",
            additionalProperties: { $ref: "#/$defs/timelineTrack" }
          }
        }
      },
      element: {
        oneOf: [
          elementSchema("path", {
            d: { type: "string" },
            x: { type: "number" },
            y: { type: "number" }
          }, ["d"]),
          elementSchema("text", {
            x: { type: "number" },
            y: { type: "number" },
            text: { type: "string" },
            lines: { type: "array", items: { type: "string" } },
            align: { enum: ["left", "center", "right"] },
            valign: { enum: ["top", "middle", "bottom"] },
            fontSize: { type: "number" },
            fontFamily: { type: "string" },
            weight: { oneOf: [{ type: "number" }, { type: "string" }] },
            fontStyle: { type: "string" },
            lineHeight: { type: "number" },
            letterSpacing: { type: "number" },
            maxWidth: { type: "number" },
            wrap: { type: "boolean" }
          }, ["x", "y"]),
          elementSchema("image", {
            src: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            fit: { $ref: "#/$defs/imageFit" },
            source: { $ref: "#/$defs/imageSource" }
          }, ["src", "x", "y", "width", "height"]),
          elementSchema("point", {
            x: { type: "number" },
            y: { type: "number" }
          }, ["x", "y"]),
          elementSchema("group", {
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            children: { type: "array", items: { $ref: "#/$defs/element" } }
          }, ["x", "y", "children"])
        ]
      }
    }
  };
}

function elementSchema(type: string, properties: JsonSchema, required: string[]): JsonSchema {
  return {
    type: "object",
    required: ["type", ...required],
    additionalProperties: false,
    properties: {
      ...commonElementProperties(),
      type: { const: type },
      ...properties
    }
  };
}

function commonElementProperties(): JsonSchema {
  return {
    id: { type: "string" },
    opacity: { type: "number" },
    fill: { $ref: "#/$defs/paint" },
    stroke: { $ref: "#/$defs/paint" },
    strokeWidth: { type: "number" },
    strokeCap: { enum: ["butt", "round", "square"] },
    strokeJoin: { enum: ["miter", "round", "bevel"] },
    miterLimit: { type: "number" },
    dashArray: { type: "array", items: { type: "number" } },
    dashOffset: { type: "number" },
    drawStart: { type: "number" },
    drawEnd: { type: "number" },
    effects: { $ref: "#/$defs/effects" },
    blendMode: { type: "string" },
    rotation: { type: "number" },
    scale: { type: "number" },
    scaleX: { type: "number" },
    scaleY: { type: "number" },
    origin: { $ref: "#/$defs/point2" },
    clip: { $ref: "#/$defs/clipShape" },
    mask: { $ref: "#/$defs/maskShape" },
    timeline: { $ref: "#/$defs/timeline" }
  };
}

function paintSchema(): JsonSchema {
  return {
    oneOf: [
      { type: "string" },
      {
        type: "object",
        required: ["type", "from", "to", "stops"],
        additionalProperties: false,
        properties: {
          type: { const: "linearGradient" },
          from: { $ref: "#/$defs/point2" },
          to: { $ref: "#/$defs/point2" },
          stops: { type: "array", minItems: 2, items: { $ref: "#/$defs/gradientStop" } }
        }
      },
      {
        type: "object",
        required: ["type", "center", "radius", "stops"],
        additionalProperties: false,
        properties: {
          type: { const: "radialGradient" },
          center: { $ref: "#/$defs/point2" },
          radius: { type: "number" },
          focus: { $ref: "#/$defs/point2" },
          stops: { type: "array", minItems: 2, items: { $ref: "#/$defs/gradientStop" } }
        }
      },
      {
        type: "object",
        required: ["type", "src", "width", "height"],
        additionalProperties: false,
        properties: {
          type: { const: "pattern" },
          src: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
          fit: { $ref: "#/$defs/imageFit" },
          opacity: { type: "number" }
        }
      }
    ]
  };
}

function effectsSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      blur: { type: "number" },
      brightness: { type: "number" },
      contrast: { type: "number" },
      saturate: { type: "number" },
      hueRotate: { type: "number" },
      shadow: {
        type: "object",
        required: ["dx", "dy", "blur", "color"],
        additionalProperties: false,
        properties: {
          dx: { type: "number" },
          dy: { type: "number" },
          blur: { type: "number" },
          color: { type: "string" },
          opacity: { type: "number" }
        }
      }
    }
  };
}
