import {
  createContext,
  useContext,
  type FormEventHandler,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ReactNode
} from "react";
import { FormProvider, type FieldValues, type SubmitHandler, type UseFormReturn } from "react-hook-form";
import { cn } from "@/shared/lib/cn";
import "./app-form.css";

interface AppFormState {
  disabled: boolean;
  loading: boolean;
}

const AppFormStateContext = createContext<AppFormState>({
  disabled: false,
  loading: false
});

export function useAppFormState() {
  return useContext(AppFormStateContext);
}

type AppFormSubmitHandler<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined
> = TTransformedValues extends FieldValues ? SubmitHandler<TTransformedValues> : SubmitHandler<TFieldValues>;

export interface AppFormProps<
  TFieldValues extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined
>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  form?: UseFormReturn<TFieldValues, unknown, TTransformedValues>;
  disabled?: boolean;
  loading?: boolean;
  onSubmit?: AppFormSubmitHandler<TFieldValues, TTransformedValues>;
  onRawSubmit?: FormEventHandler<HTMLFormElement>;
}

export function AppForm<
  TFieldValues extends FieldValues = FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined
>({
  form,
  disabled = false,
  loading = false,
  onSubmit,
  onRawSubmit,
  className,
  children,
  noValidate = true,
  ...props
}: AppFormProps<TFieldValues, TTransformedValues>) {
  const submitHandler =
    form && onSubmit
      ? form.handleSubmit(onSubmit as Parameters<UseFormReturn<TFieldValues, unknown, TTransformedValues>["handleSubmit"]>[0])
      : onRawSubmit;

  const content = (
    <AppFormStateContext.Provider value={{ disabled, loading }}>
      <form
        className={cn("app-form", className)}
        noValidate={noValidate}
        onSubmit={submitHandler}
        {...props}
      >
        {children}
      </form>
    </AppFormStateContext.Provider>
  );

  return form ? <FormProvider {...form}>{content}</FormProvider> : content;
}

export interface AppFormSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function AppFormSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: AppFormSectionProps) {
  return (
    <section className={cn("app-form-section", className)} {...props}>
      {title || description || actions ? (
        <div className="app-form-section__head">
          <div className="app-form-section__copy">
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="app-form-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface AppFormGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3;
}

export function AppFormGrid({ columns = 2, className, children, ...props }: AppFormGridProps) {
  return (
    <div
      className={cn(
        "app-form-grid shared-form-grid",
        columns === 1 && "app-form-grid--one",
        columns === 2 && "shared-form-grid--two",
        columns === 3 && "shared-form-grid--three",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface AppFormFieldProps extends HTMLAttributes<HTMLLabelElement> {
  label: ReactNode;
  description?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

export function AppFormField({
  label,
  description,
  help,
  error,
  required = false,
  disabled = false,
  invalid,
  className,
  children,
  ...props
}: AppFormFieldProps) {
  const resolvedInvalid = invalid ?? Boolean(error);

  return (
    <label
      className={cn(
        "app-form-field shared-form-field",
        resolvedInvalid && "app-form-field--invalid",
        disabled && "app-form-field--disabled",
        className
      )}
      data-required={required || undefined}
      data-invalid={resolvedInvalid || undefined}
      {...props}
    >
      <span className="app-form-field__label shared-form-field__label">{label}</span>
      {description || help ? <AppFormHelpText>{description ?? help}</AppFormHelpText> : null}
      {children}
      {error ? <AppFormError>{error}</AppFormError> : null}
    </label>
  );
}

export interface AppFormHelpTextProps extends HTMLAttributes<HTMLSpanElement> {}

export function AppFormHelpText({ className, children, ...props }: AppFormHelpTextProps) {
  if (!children) return null;
  return (
    <span className={cn("app-form-help-text", className)} {...props}>
      {children}
    </span>
  );
}

export interface AppFormErrorProps extends HTMLAttributes<HTMLSpanElement> {}

export function AppFormError({ className, children, ...props }: AppFormErrorProps) {
  if (!children) return null;
  return (
    <span className={cn("app-form-error", className)} role="alert" {...props}>
      {children}
    </span>
  );
}

export interface AppFormActionsProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "between";
}

export function AppFormActions({ align = "end", className, children, ...props }: AppFormActionsProps) {
  return (
    <div className={cn("app-form-actions shared-actions-row", `app-form-actions--${align}`, className)} {...props}>
      {children}
    </div>
  );
}
