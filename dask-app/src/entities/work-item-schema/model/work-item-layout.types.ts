export type WorkItemLayoutSurface = "card" | "detail" | "form";

export interface WorkItemLayoutFieldRef {
  fieldId: string;
  area?: string;
  section?: string | null;
  order: number;
  visible?: boolean;
  required?: boolean;
  readonly?: boolean;
  display?: Record<string, unknown>;
}

export interface WorkItemPublicLayout {
  surface: WorkItemLayoutSurface;
  fields: WorkItemLayoutFieldRef[];
  sections?: Array<{
    id: string;
    title: string;
    order: number;
  }>;
}

