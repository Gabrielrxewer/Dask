import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./button.css";

type ButtonVariant = "default" | "primary" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`shared-button shared-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
