import type { ImageElement, KernelElement, ValidationIssue, ValidationWarning, VisualDocument, VisualElement } from "../types";

export interface ShapeLoweringContext {
  lowerElements(elements: VisualElement[]): KernelElement[];
}

export interface ShapeValidationContext {
  document: VisualDocument;
  path: string;
  ids: Map<string, VisualElement>;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  addIssue(path: string, code: string, message: string, suggestion?: string): void;
  addWarning(path: string, code: string, message: string, suggestion?: string): void;
  requireNumber(value: unknown, path: string): void;
  requirePoint2(value: unknown, path: string, code: string, message: string): void;
  requirePoint2Array(value: unknown, minLength: number, path: string, code: string, message: string): void;
  requirePoint3(value: unknown, path: string, code: string, message: string): void;
  validateEndpoint(value: unknown, path: string): void;
  validateImageOptions(element: ImageElement): void;
  isFollowable(type: string): boolean;
}

export interface ShapeSchemaFragment {
  properties?: Record<string, unknown>;
}

export interface ShapeDefinition {
  type: string;
  kind: "2d" | "3d";
  animatable: string[];
  followable?: boolean;
  schema?: ShapeSchemaFragment;
  lower(element: VisualElement, context: ShapeLoweringContext): KernelElement | KernelElement[];
  validateGeometry(element: VisualElement, context: ShapeValidationContext): void;
  validateReferences?(element: VisualElement, context: ShapeValidationContext): void;
  validateWarnings?(element: VisualElement, context: ShapeValidationContext): void;
}
