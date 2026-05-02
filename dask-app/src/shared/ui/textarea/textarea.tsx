import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = "", ...props }, ref) => {
  return <textarea ref={ref} className={cn("shared-textarea", className)} {...props} />;
});

Textarea.displayName = "Textarea";
