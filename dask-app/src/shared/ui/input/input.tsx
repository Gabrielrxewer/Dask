import type { InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
import "./input.css";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input className={cn("shared-input", className)} {...props} />;
}
