import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import "./button.css";

export type ButtonVariant = "default" | "primary" | "outline";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn("shared-button", `shared-button--${variant}`, `shared-button--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
