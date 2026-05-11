import { FormProvider, type UseFormReturn } from "react-hook-form";
import type { ReactNode } from "react";
import type { WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";

export interface WorkItemFormProviderProps {
  form: UseFormReturn<WorkItemFormValues>;
  children: ReactNode;
}

export function WorkItemFormProvider({ form, children }: WorkItemFormProviderProps) {
  return <FormProvider {...form}>{children}</FormProvider>;
}

