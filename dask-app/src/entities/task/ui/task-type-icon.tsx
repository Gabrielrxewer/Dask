import { AppIcon, type AppIconName } from "@/shared/ui";

export type TaskTypeIconName =
  | "bug"
  | "user"
  | "checklist"
  | "book"
  | "layers"
  | "flask"
  | "alert"
  | "wrench"
  | "gear"
  | "document";

const TASK_TYPE_ICON_MAP: Record<TaskTypeIconName, AppIconName> = {
  bug: "bug",
  user: "user",
  checklist: "list-checks",
  book: "documentation",
  layers: "layers",
  flask: "flask",
  alert: "alert-circle",
  wrench: "wrench",
  gear: "settings",
  document: "file"
};

export function resolveTaskTypeIconName(taskTypeId: string): TaskTypeIconName {
  switch (taskTypeId) {
    case "bug":
      return "bug";
    case "user-story":
      return "user";
    case "task":
      return "checklist";
    case "improvement":
      return "book";
    case "epic":
      return "layers";
    case "spike":
    case "research":
      return "flask";
    case "incident":
      return "alert";
    case "hotfix":
      return "wrench";
    case "chore":
      return "gear";
    default:
      return "document";
  }
}

export function TaskTypeIcon({ name }: { name: TaskTypeIconName }) {
  return <AppIcon name={TASK_TYPE_ICON_MAP[name]} size={18} strokeWidth={1.9} />;
}
