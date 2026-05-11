import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Controller, useFormContext, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { AppCheckbox } from "@/shared/ui/checkbox";
import { AppDatePicker, AppDateTimePicker } from "@/shared/ui/date-picker";
import { AppFormField, useAppFormState } from "@/shared/ui/form";
import { TextInput, type TextInputProps } from "@/shared/ui/input";
import { AppSelect, type AppSelectItem } from "@/shared/ui/select";
import { AppSwitch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";

type FieldChangeCallback<TValue> = (value: TValue) => void;

interface AppControlledFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  name: TName;
  control?: Control<TFieldValues>;
  label: ReactNode;
  description?: ReactNode;
  help?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function toTextValue(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function toOptionalTextValue(value: unknown): string | undefined {
  const text = toTextValue(value);
  return text.length > 0 ? text : undefined;
}

function toDateValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function useResolvedControl<TFieldValues extends FieldValues>(control?: Control<TFieldValues>) {
  const methods = useFormContext<TFieldValues>();
  return control ?? methods?.control;
}

function useResolvedDisabled(disabled?: boolean) {
  const formState = useAppFormState();
  return Boolean(disabled || formState.disabled || formState.loading);
}

export interface AppTextFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends AppControlledFieldProps<TFieldValues, TName>,
    Omit<TextInputProps, "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "disabled" | "required"> {
  formatValue?: (value: unknown) => string;
  parseValue?: (value: string) => unknown;
  normalizeOnBlur?: (value: string) => unknown;
  onValueChange?: FieldChangeCallback<string>;
}

export function AppTextField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  formatValue = toTextValue,
  parseValue,
  normalizeOnBlur,
  onValueChange,
  ...inputProps
}: AppTextFieldProps<TFieldValues, TName>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <TextInput
            {...inputProps}
            ref={field.ref}
            name={field.name}
            value={formatValue(field.value)}
            disabled={resolvedDisabled}
            required={required}
            aria-invalid={fieldState.invalid || undefined}
            onBlur={(event) => {
              field.onBlur();
              if (normalizeOnBlur) {
                field.onChange(normalizeOnBlur(event.target.value));
              }
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              field.onChange(parseValue ? parseValue(nextValue) : nextValue);
              onValueChange?.(nextValue);
            }}
          />
        </AppFormField>
      )}
    />
  );
}

export interface AppMoneyFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends Omit<AppTextFieldProps<TFieldValues, TName>, "inputMode" | "type"> {}

export function AppMoneyField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: AppMoneyFieldProps<TFieldValues, TName>) {
  return (
    <AppTextField
      {...props}
      type="text"
      inputMode="decimal"
    />
  );
}

export interface AppTextareaFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends AppControlledFieldProps<TFieldValues, TName>,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "disabled" | "required"> {
  formatValue?: (value: unknown) => string;
  parseValue?: (value: string) => unknown;
  onValueChange?: FieldChangeCallback<string>;
}

export function AppTextareaField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  formatValue = toTextValue,
  parseValue,
  onValueChange,
  ...textareaProps
}: AppTextareaFieldProps<TFieldValues, TName>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <Textarea
            {...textareaProps}
            ref={field.ref}
            name={field.name}
            value={formatValue(field.value)}
            disabled={resolvedDisabled}
            required={required}
            aria-invalid={fieldState.invalid || undefined}
            onBlur={field.onBlur}
            onChange={(event) => {
              const nextValue = event.target.value;
              field.onChange(parseValue ? parseValue(nextValue) : nextValue);
              onValueChange?.(nextValue);
            }}
          />
        </AppFormField>
      )}
    />
  );
}

export interface AppSelectFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue extends string = string
> extends AppControlledFieldProps<TFieldValues, TName> {
  options: Array<AppSelectItem<TValue>>;
  placeholder?: ReactNode;
  formatValue?: (value: unknown) => TValue | undefined;
  parseValue?: (value: TValue) => unknown;
  onValueChange?: (value: TValue, formValue: unknown) => void;
}

export function AppSelectField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TValue extends string = string
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  options,
  placeholder,
  formatValue = (value) => toOptionalTextValue(value) as TValue | undefined,
  parseValue,
  onValueChange
}: AppSelectFieldProps<TFieldValues, TName, TValue>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <AppSelect<TValue>
            items={options}
            value={formatValue(field.value)}
            placeholder={placeholder}
            disabled={resolvedDisabled}
            aria-label={typeof label === "string" ? label : undefined}
            onValueChange={(nextValue) => {
              const formValue = parseValue ? parseValue(nextValue) : nextValue;
              field.onChange(formValue);
              onValueChange?.(nextValue, formValue);
            }}
          />
        </AppFormField>
      )}
    />
  );
}

export interface AppDateFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends AppControlledFieldProps<TFieldValues, TName> {
  placeholder?: string;
  formatValue?: (value: unknown) => string | null;
  parseValue?: (value: string | null) => unknown;
  onValueChange?: FieldChangeCallback<string | null>;
}

export type AppDateTimeFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = AppDateFieldProps<TFieldValues, TName>;

export function AppDateField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  placeholder,
  formatValue = toDateValue,
  parseValue,
  onValueChange
}: AppDateFieldProps<TFieldValues, TName>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <AppDatePicker
            value={formatValue(field.value)}
            onChange={(nextValue) => {
              field.onChange(parseValue ? parseValue(nextValue) : nextValue);
              onValueChange?.(nextValue);
            }}
            disabled={resolvedDisabled}
            placeholder={placeholder}
            aria-label={typeof label === "string" ? label : undefined}
          />
        </AppFormField>
      )}
    />
  );
}

export function AppDateTimeField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: AppDateFieldProps<TFieldValues, TName>) {
  const {
    name,
    control,
    label,
    description,
    help,
    disabled,
    required,
    className,
    placeholder,
    formatValue = toDateValue,
    parseValue,
    onValueChange
  } = props;
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <AppDateTimePicker
            value={formatValue(field.value)}
            onChange={(nextValue) => {
              field.onChange(parseValue ? parseValue(nextValue) : nextValue);
              onValueChange?.(nextValue);
            }}
            disabled={resolvedDisabled}
            placeholder={placeholder}
            aria-label={typeof label === "string" ? label : undefined}
          />
        </AppFormField>
      )}
    />
  );
}

export interface AppCheckboxFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends AppControlledFieldProps<TFieldValues, TName> {
  onValueChange?: FieldChangeCallback<boolean>;
}

export function AppCheckboxField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  onValueChange
}: AppCheckboxFieldProps<TFieldValues, TName>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <AppCheckbox
            checked={Boolean(field.value)}
            disabled={resolvedDisabled}
            aria-label={typeof label === "string" ? label : undefined}
            onCheckedChange={(nextValue) => {
              const checked = nextValue === true;
              field.onChange(checked);
              onValueChange?.(checked);
            }}
          />
        </AppFormField>
      )}
    />
  );
}

export interface AppSwitchFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends AppControlledFieldProps<TFieldValues, TName> {
  onValueChange?: FieldChangeCallback<boolean>;
}

export function AppSwitchField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  label,
  description,
  help,
  disabled,
  required,
  className,
  onValueChange
}: AppSwitchFieldProps<TFieldValues, TName>) {
  const resolvedControl = useResolvedControl(control);
  const resolvedDisabled = useResolvedDisabled(disabled);

  return (
    <Controller
      control={resolvedControl}
      name={name}
      render={({ field, fieldState }) => (
        <AppFormField
          label={label}
          description={description}
          help={help}
          error={fieldState.error?.message}
          required={required}
          disabled={resolvedDisabled}
          className={className}
        >
          <AppSwitch
            checked={Boolean(field.value)}
            disabled={resolvedDisabled}
            onCheckedChange={(checked) => {
              field.onChange(checked);
              onValueChange?.(checked);
            }}
          />
        </AppFormField>
      )}
    />
  );
}
