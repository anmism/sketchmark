// ============================================================
// Shape Registry — registers all built-in shapes
//
// To add a new shape:
//   1. Create src/renderer/shapes/my-shape.ts implementing ShapeDefinition
//   2. Import and register it here
//   3. Add the shape name to NodeShape union in ast/types.ts
//   4. Add to SHAPES array in parser/index.ts and KEYWORDS in tokenizer.ts
// ============================================================

export type { ShapeDefinition, RoughSVG, RoughCanvas, RoughOpts } from "./types";
export { SVG_NS, FONT_PX_PER_CHAR, BASE_PAD } from "./types";
export { registerShape, getShape, hasShape } from "./registry";

import { registerShape } from "./registry";
import { boxShape } from "./box";
import { circleShape } from "./circle";
import { diamondShape } from "./diamond";
import { hexagonShape } from "./hexagon";
import { triangleShape } from "./triangle";
import { cylinderShape } from "./cylinder";
import { parallelogramShape } from "./parallelogram";
import { textShape } from "./text-shape";
import { iconShape } from "./icon";
import { imageShape } from "./image";
import { noteShape } from "./note";
import { lineShape } from "./line";
import { pathShape } from "./path";

registerShape("box", boxShape);
registerShape("circle", circleShape);
registerShape("diamond", diamondShape);
registerShape("hexagon", hexagonShape);
registerShape("triangle", triangleShape);
registerShape("cylinder", cylinderShape);
registerShape("parallelogram", parallelogramShape);
registerShape("text", textShape);
registerShape("icon", iconShape);
registerShape("image", imageShape);
registerShape("note", noteShape);
registerShape("line", lineShape);
registerShape("path", pathShape);
