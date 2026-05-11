import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import "./button.css";

export type ButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  onClick,
  type = "button",
  variant = "default",
  size = "md",
  loading = false,
  className = "",
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      className={cn("shared-button", `shared-button--${variant}`, `shared-button--${size}`, className)}
      aria-busy={loading || undefined}
      {...props}
      disabled={props.disabled || loading}
    >
      {children}
    </button>
  );
});
