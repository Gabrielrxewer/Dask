import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import "./input.css";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(({ className = "", ...props }, ref) => {
  return <input ref={ref} className={cn("shared-input", className)} {...props} />;
});

TextInput.displayName = "TextInput";
