import { useEffect, useMemo, type ReactNode } from "react";
import { Controller, useForm, useFormContext, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AppCheckbox,
  AppDatePicker,
  AppDateTimePicker,
  AppForm,
  AppFormActions,
  AppFormField,
  AppFormSection,
  AppPopover,
  AppSelect,
  AppSwitch,
  AppTextareaField,
  Button,
  Textarea,
  TextInput
} from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { buildNodeConfigZodSchema } from "./schema";
import type {
  NodeConfigComponentRegistry,
  NodeConfigDescriptor,
  NodeConfigFieldDescriptor,
  NodeConfigFormContext
} from "./types";
import "./node-config-form.css";

type NodeConfigValues = Record<string, unknown>;

function toText(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJson(value: string): unknown {
  if (!value.trim()) return {};
  return JSON.parse(value);
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Informe um objeto JSON valido.");
  }
  return parsed as Record<string, unknown>;
}

const advancedConfigSchema = z.object({
  json: z.string().superRefine((value, ctx) => {
    try {
      parseJsonRecord(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "JSON invalido. Corrija antes de aplicar."
      });
    }
  })
}).transform(({ json }) => parseJsonRecord(json));

type AdvancedConfigInput = z.input<typeof advancedConfigSchema>;
type AdvancedConfigValues = z.output<typeof advancedConfigSchema>;

function fieldError(errors: unknown, name: string): string | undefined {
  const segments = name.split(".");
  let current = errors as Record<string, unknown> | undefined;
  for (const segment of segments) {
    if (!current || typeof current !== "object") return undefined;
    current = current[segment] as Record<string, unknown> | undefined;
  }
  const maybe = current as { message?: unknown } | undefined;
  return typeof maybe?.message === "string" ? maybe.message : undefined;
}

export interface NodeConfigFieldProps {
  field: NodeConfigFieldDescriptor;
  componentRegistry?: NodeConfigComponentRegistry;
  context: NodeConfigFormContext;
}

export function NodeConfigField({ field, componentRegistry, context }: NodeConfigFieldProps) {
  const { control, formState } = useFormContext<NodeConfigValues>();
  const error = fieldError(formState.errors, field.name);
  const registryKey = field.component ?? field.type;
  const CustomField = componentRegistry?.[registryKey];

  return (
    <Controller
      control={control}
      name={field.name}
      render={({ field: controllerField }) => {
        const value = controllerField.value;
        const onChange = controllerField.onChange;

        if (CustomField) {
          return (
            <FieldFrame field={field} error={error}>
              {CustomField({ field, value, onChange, error, context })}
            </FieldFrame>
          );
        }

        return (
          <FieldFrame field={field} error={error}>
            {field.type === "textarea" ? (
              <Textarea
                className="node-config-form__textarea"
                rows={field.rows ?? 4}
                value={toText(value)}
                placeholder={field.placeholder}
                disabled={field.disabled}
                onChange={(event) => onChange(event.target.value)}
              />
            ) : null}

            {field.type === "text" || field.type === "secret-reference" || field.type === "model-selector" || field.type === "tool-selector" || field.type === "template-selector" || field.type === "work-item-type-selector" || field.type === "workflow-state-selector" ? (
              field.options?.length ? (
                <AppSelect
                  items={field.options.map((option) => ({
                    value: option.value,
                    label: option.label,
                    description: option.description,
                    disabled: option.disabled
                  }))}
                  value={toText(value)}
                  onValueChange={onChange}
                  placeholder={field.placeholder ?? "Selecione"}
                  disabled={field.disabled}
                  aria-label={field.label}
                />
              ) : (
                <TextInput
                  value={toText(value)}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  onChange={(event) => onChange(event.target.value)}
                />
              )
            ) : null}

            {field.type === "number" ? (
              <TextInput
                type="number"
                value={toText(value)}
                min={field.min}
                max={field.max}
                step={field.step}
                placeholder={field.placeholder}
                disabled={field.disabled}
                onChange={(event) => onChange(toNumber(event.target.value))}
              />
            ) : null}

            {field.type === "boolean" ? (
              <div className="node-config-form__switch">
                <AppSwitch
                  checked={Boolean(value)}
                  disabled={field.disabled}
                  onCheckedChange={onChange}
                />
                <span>{field.placeholder ?? "Ativo"}</span>
              </div>
            ) : null}

            {field.type === "select" ? (
              <AppSelect
                items={(field.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                  description: option.description,
                  disabled: option.disabled
                }))}
                value={toText(value)}
                onValueChange={onChange}
                placeholder={field.placeholder ?? "Selecione"}
                disabled={field.disabled}
                aria-label={field.label}
              />
            ) : null}

            {field.type === "multi-select" ? (
              <div className="node-config-form__check-list">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(value) ? value.map(String).includes(option.value) : false;
                  return (
                    <div key={option.value} className="node-config-form__check-item">
                      <AppCheckbox
                        checked={selected}
                        disabled={field.disabled || option.disabled}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(value) ? value.map(String) : [];
                          onChange(checked === true
                            ? [...current, option.value]
                            : current.filter((entry) => entry !== option.value));
                        }}
                        aria-label={typeof option.label === "string" ? option.label : undefined}
                      />
                      <span>{option.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {field.type === "date" ? (
              <AppDatePicker
                value={typeof value === "string" ? value : null}
                onChange={onChange}
                disabled={field.disabled}
                placeholder={field.placeholder}
                aria-label={field.label}
              />
            ) : null}

            {field.type === "datetime" ? (
              <AppDateTimePicker
                value={typeof value === "string" ? value : null}
                onChange={onChange}
                disabled={field.disabled}
                placeholder={field.placeholder}
                aria-label={field.label}
              />
            ) : null}

            {field.type === "json" ? (
              <Textarea
                className="node-config-form__textarea node-config-form__textarea--code"
                rows={field.rows ?? 5}
                value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}
                disabled={field.disabled}
                onChange={(event) => {
                  try {
                    onChange(parseJson(event.target.value));
                  } catch {
                    onChange(event.target.value);
                  }
                }}
              />
            ) : null}
          </FieldFrame>
        );
      }}
    />
  );
}

function FieldFrame({
  field,
  error,
  children
}: {
  field: NodeConfigFieldDescriptor;
  error?: string;
  children: ReactNode;
}) {
  return (
    <AppFormField
      label={field.label}
      description={field.description}
      error={error}
      disabled={field.disabled}
      className={cn("node-config-form__field", error && "node-config-form__field--invalid")}
    >
      {children}
    </AppFormField>
  );
}

export function NodeConfigSection({
  title,
  description,
  children
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppFormSection className="node-config-form__section" title={title} description={description}>
      {children}
    </AppFormSection>
  );
}

export function NodeConfigJsonPreview({ value }: { value: Record<string, unknown> }) {
  return <pre className="node-config-form__json">{JSON.stringify(value, null, 2)}</pre>;
}

export function NodeConfigValidationErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="node-config-form__errors">
      {errors.map((error) => (
        <span key={error}>{error}</span>
      ))}
    </div>
  );
}

export function NodeConfigAdvancedSettings({
  value,
  onChange
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const form = useForm<AdvancedConfigInput, unknown, AdvancedConfigValues>({
    resolver: zodResolver(advancedConfigSchema),
    defaultValues: { json: JSON.stringify(value, null, 2) },
    mode: "onChange"
  });

  useEffect(() => {
    form.reset({ json: JSON.stringify(value, null, 2) });
  }, [form, value]);

  return (
    <AppPopover
      align="end"
      contentClassName="node-config-form__advanced"
      trigger={
        <Button size="sm" variant="ghost">
          Config tecnica
        </Button>
      }
    >
      <div className="node-config-form__advanced-head">
        <strong>Config tecnica</strong>
        <span>Use apenas para propriedades sem campo estruturado.</span>
      </div>
      <AppForm
        form={form}
        className="node-config-form__advanced-form"
        onSubmit={(nextValue) => onChange(nextValue)}
      >
        <AppTextareaField<AdvancedConfigInput, "json">
          name="json"
          label="JSON"
          className="node-config-form__advanced-field"
          inputMode="text"
          rows={8}
        />
        <Button size="sm" variant="outline" type="submit">
          Aplicar JSON
        </Button>
      </AppForm>
    </AppPopover>
  );
}

export interface NodeConfigFormProps {
  descriptor: NodeConfigDescriptor;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  componentRegistry?: NodeConfigComponentRegistry;
  className?: string;
  showJsonPreview?: boolean;
  submitLabel?: string;
}

export function NodeConfigForm({
  descriptor,
  value,
  onChange,
  componentRegistry,
  className,
  showJsonPreview = false,
  submitLabel = "Aplicar"
}: NodeConfigFormProps) {
  const schema = useMemo(() => descriptor.validation?.schema ?? buildNodeConfigZodSchema(descriptor), [descriptor]);
  const resolver = useMemo(() => zodResolver(schema) as Resolver<NodeConfigValues>, [schema]);
  const methods = useForm<NodeConfigValues>({
    resolver,
    values: value,
    mode: "onChange"
  });
  const context = useMemo<NodeConfigFormContext>(() => ({ nodeType: descriptor.type, descriptor }), [descriptor]);

  useEffect(() => {
    const subscription = methods.watch((nextValue) => {
      onChange(nextValue as Record<string, unknown>);
    });
    return () => subscription.unsubscribe();
  }, [methods, onChange]);

  const sections = descriptor.sections?.length
    ? descriptor.sections
    : [{ id: "main", title: descriptor.label, description: descriptor.description }];
  const fieldsBySection = new Map<string, NodeConfigFieldDescriptor[]>();
  for (const field of descriptor.fields) {
    const section = field.section ?? sections[0]?.id ?? "main";
    fieldsBySection.set(section, [...(fieldsBySection.get(section) ?? []), field]);
  }

  return (
    <AppForm
      form={methods}
      className={cn("node-config-form", className)}
      onSubmit={(nextValue) => onChange(nextValue)}
    >
      {sections.map((section) => (
        <NodeConfigSection key={section.id} title={section.title} description={section.description}>
          {(fieldsBySection.get(section.id) ?? []).map((field) => (
            <NodeConfigField
              key={field.name}
              field={field}
              componentRegistry={componentRegistry}
              context={context}
            />
          ))}
        </NodeConfigSection>
      ))}

      {showJsonPreview ? <NodeConfigJsonPreview value={methods.getValues()} /> : null}

      <AppFormActions align="start">
        <Button className="node-config-form__submit" size="sm" variant="outline" type="submit">
          {submitLabel}
        </Button>
      </AppFormActions>
    </AppForm>
  );
}
