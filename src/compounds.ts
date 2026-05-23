import type { VisualDocument, VisualElement } from "./types";
import { callout, column, flow, node, packet, row } from "./builders";
import { clone } from "./utils";

type LooseElement = Record<string, unknown> & { type?: string; children?: LooseElement[] };
type LooseDocument = Omit<VisualDocument, "elements" | "scenes"> & {
  elements?: LooseElement[];
  scenes?: Record<string, Record<string, unknown> & { elements?: LooseElement[] }>;
};

export function compileCompounds(input: LooseDocument): VisualDocument {
  const document = clone(input) as LooseDocument;
  const elements = compileElementList(document.elements ?? []);
  const scenes: VisualDocument["scenes"] = {};
  for (const [sceneId, scene] of Object.entries(document.scenes ?? {})) {
    scenes[sceneId] = {
      ...scene,
      elements: compileElementList(scene.elements ?? [])
    } as NonNullable<VisualDocument["scenes"]>[string];
  }
  return {
    ...(document as unknown as VisualDocument),
    elements,
    ...(Object.keys(scenes).length ? { scenes } : {})
  };
}

function compileElementList(elements: LooseElement[]): VisualElement[] {
  return elements.flatMap((element) => compileElement(element));
}

function compileElement(element: LooseElement): VisualElement[] {
  switch (element.type) {
    case "node":
      return node({
        id: stringProp(element, "id"),
        label: stringProp(element, "label"),
        x: numberProp(element, "x"),
        y: numberProp(element, "y"),
        width: numberProp(element, "width"),
        height: numberProp(element, "height"),
        radius: optionalNumber(element, "radius"),
        fill: optionalString(element, "fill"),
        stroke: optionalString(element, "stroke"),
        strokeWidth: optionalNumber(element, "strokeWidth"),
        fontSize: optionalNumber(element, "fontSize"),
        textFill: optionalString(element, "textFill")
      });
    case "flow":
      return flow({
        id: stringProp(element, "id"),
        from: element.from as never,
        to: element.to as never,
        stroke: optionalString(element, "stroke"),
        strokeWidth: optionalNumber(element, "strokeWidth"),
        label: optionalString(element, "label"),
        labelX: optionalNumber(element, "labelX"),
        labelY: optionalNumber(element, "labelY")
      });
    case "packet":
      return [
        packet({
          id: stringProp(element, "id"),
          on: stringProp(element, "on"),
          radius: optionalNumber(element, "radius"),
          fill: optionalString(element, "fill"),
          progress: element.progress as never
        })
      ];
    case "callout":
      return callout({
        id: stringProp(element, "id"),
        text: stringProp(element, "text"),
        x: numberProp(element, "x"),
        y: numberProp(element, "y"),
        width: numberProp(element, "width"),
        height: numberProp(element, "height"),
        target: element.target as never,
        fill: optionalString(element, "fill"),
        textFill: optionalString(element, "textFill"),
        stroke: optionalString(element, "stroke")
      });
    case "row":
      return row({
        x: numberProp(element, "x"),
        y: numberProp(element, "y"),
        gap: optionalNumber(element, "gap"),
        children: (element.children ?? []).map((child) => compileElement(child))
      });
    case "column":
      return column({
        x: numberProp(element, "x"),
        y: numberProp(element, "y"),
        gap: optionalNumber(element, "gap"),
        children: (element.children ?? []).map((child) => compileElement(child))
      });
    default: {
      const next = clone(element) as unknown as VisualElement;
      if (next.type === "group" && Array.isArray(next.children)) {
        next.children = compileElementList(next.children as unknown as LooseElement[]);
      }
      return [next];
    }
  }
}

function stringProp(element: LooseElement, key: string): string {
  const value = element[key];
  if (typeof value !== "string" || !value) throw new Error(`Compound '${element.type}' requires string '${key}'.`);
  return value;
}

function optionalString(element: LooseElement, key: string): string | undefined {
  const value = element[key];
  return typeof value === "string" ? value : undefined;
}

function numberProp(element: LooseElement, key: string): number {
  const value = element[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Compound '${element.type}' requires number '${key}'.`);
  return value;
}

function optionalNumber(element: LooseElement, key: string): number | undefined {
  const value = element[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
