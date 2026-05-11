import type { ReactNode } from "react";
import type { z } from "zod";

export type NodeConfigFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "date"
  | "datetime"
  | "json"
  | "secret-reference"
  | "model-selector"
  | "tool-selector"
  | "template-selector"
  | "work-item-type-selector"
  | "workflow-state-selector";

export interface NodeConfigFieldOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface NodeConfigFieldDescriptor {
  name: string;
  label: string;
  type: NodeConfigFieldType;
  section?: string;
  description?: ReactNode;
  placeholder?: string;
  required?: boolean;
  options?: NodeConfigFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  defaultValue?: unknown;
  disabled?: boolean;
  component?: string;
}

export interface NodeConfigFormSection {
  id: string;
  title: string;
  description?: ReactNode;
}

export interface NodeConfigValidationDescriptor {
  schema?: z.ZodType<Record<string, unknown>, Record<string, unknown>>;
  required?: string[];
  requiredAny?: string[][];
}

export interface NodeConfigDescriptor {
  type: string;
  label: string;
  description?: ReactNode;
  sections?: NodeConfigFormSection[];
  fields: NodeConfigFieldDescriptor[];
  validation?: NodeConfigValidationDescriptor;
}

export interface NodeConfigFormContext {
  nodeType: string;
  descriptor: NodeConfigDescriptor;
}

export type NodeConfigComponent = (props: {
  field: NodeConfigFieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  context: NodeConfigFormContext;
}) => ReactNode;

export type NodeConfigComponentRegistry = Record<string, NodeConfigComponent>;
