import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import "./workspace-action-button.css";

type WorkspaceActionButtonTone = "default" | "accent" | "danger";

interface WorkspaceActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  tone?: WorkspaceActionButtonTone;
}

export function WorkspaceActionButton({
  label,
  icon,
  tone = "default",
  type = "button",
  className = "",
  ...props
}: WorkspaceActionButtonProps) {
  return (
    <button
      type={type}
      className={cn("workspace-action-button", `workspace-action-button--${tone}`, className)}
      aria-label={props["aria-label"] ?? label}
      title={props.title ?? label}
      {...props}
    >
      <span className="workspace-action-button__icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
