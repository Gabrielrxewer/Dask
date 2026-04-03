import type { InputHTMLAttributes } from "react";
import "./input.css";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className = "", ...props }: TextInputProps) {
  return <input className={`shared-input ${className}`.trim()} {...props} />;
}
