// ============================================================
// Entity Rect Map — unified lookup for all positionable entities
//
// Every scene entity (node, group, table, chart, markdown)
// has { x, y, w, h }. This map lets layout code look up any
// entity by ID without kind dispatch.
// ============================================================

import type {
  SceneGraph,
} from "../scene";

export interface EntityRect {
  x: number;
  y: number;
  w: number;
  h: number;
  authoredX?: number;
  authoredY?: number;
}

export function buildEntityMap(sg: SceneGraph): Map<string, EntityRect> {
  const m = new Map<string, EntityRect>();
  for (const n of sg.nodes)      m.set(n.id, n);
  for (const g of sg.groups)     m.set(g.id, g);
  for (const t of sg.tables)     m.set(t.id, t);
  for (const c of sg.charts)     m.set(c.id, c);
  for (const md of sg.markdowns) m.set(md.id, md);
  return m;
}
