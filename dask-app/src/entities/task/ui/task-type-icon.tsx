type TaskTypeIconName =
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
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false
  };

  if (name === "bug") {
    return (
      <svg {...commonProps}>
        <path d="M12 8.5v10" />
        <path d="M9.4 7 8 5.6" />
        <path d="M14.6 7 16 5.6" />
        <path d="M9 11 6.7 9.8" />
        <path d="M15 11 17.3 9.8" />
        <path d="M9 14.6 6.9 15.8" />
        <path d="M15 14.6 17.1 15.8" />
        <path d="M12 6.5c2.7 0 4.8 2.3 4.8 5.1 0 3.3-2.2 5.9-4.8 5.9s-4.8-2.6-4.8-5.9c0-2.8 2.1-5.1 4.8-5.1Z" />
        <path d="M12 6.5c-1.1-1.4-.9-2.7 0-3.5.9.8 1.1 2.1 0 3.5Z" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...commonProps}>
        <path d="M7.5 4.5h6.8L18 8.2v11.3a1 1 0 0 1-1 1H7.5a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M14.3 4.5V8H18" />
        <circle cx="12" cy="11.3" r="2" />
        <path d="M8.9 16.7a3.5 3.5 0 0 1 6.2 0" />
      </svg>
    );
  }

  if (name === "checklist") {
    return (
      <svg {...commonProps}>
        <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
        <path d="m8.2 9.2 1.3 1.3 2.6-2.6" />
        <path d="M11.8 9.2h3.8" />
        <path d="m8.2 14.2 1.3 1.3 2.6-2.6" />
        <path d="M11.8 14.2h3.8" />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg {...commonProps}>
        <path d="m12 5.2 1.5 3.2 3.5.4-2.6 2.4.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.6-2.4 3.5-.4L12 5.2Z" />
      </svg>
    );
  }

  if (name === "layers") {
    return (
      <svg {...commonProps}>
        <path d="m12 5 6.5 3.5L12 12 5.5 8.5 12 5Z" />
        <path d="m5.5 12 6.5 3.5 6.5-3.5" />
        <path d="m5.5 15.5 6.5 3.5 6.5-3.5" />
      </svg>
    );
  }

  if (name === "flask") {
    return (
      <svg {...commonProps}>
        <path d="M10 4h4" />
        <path d="M12 4v4.5l4.1 6.2A1.8 1.8 0 0 1 14.6 17H9.4a1.8 1.8 0 0 1-1.5-2.3L12 8.5" />
        <path d="M9.3 13h5.4" />
      </svg>
    );
  }

  if (name === "alert") {
    return (
      <svg {...commonProps}>
        <path d="M12 5.2 18.2 17H5.8L12 5.2Z" />
        <path d="M12 9.2v4.1" />
        <path d="M12 15.8h.01" />
      </svg>
    );
  }

  if (name === "wrench") {
    return (
      <svg {...commonProps}>
        <path d="M15 6.4a3.4 3.4 0 0 0 3.8 4.3l-7.7 7.7a1.8 1.8 0 1 1-2.5-2.5l7.7-7.7A3.4 3.4 0 0 1 15 6.4Z" />
      </svg>
    );
  }

  if (name === "gear") {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="2.7" />
        <path d="m12 4.6.9 1.8 2 .3.3 2 .9.5-.9.8.3 2-2 .3-.9 1.8-.9-1.8-2-.3-.3-2-.9-.8.9-.5.3-2 2-.3.9-1.8Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M7.5 4.5h6.8L18 8.2v11.3a1 1 0 0 1-1 1H7.5A1.5 1.5 0 0 1 6 19V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M14.3 4.5V8H18" />
      <path d="M9 12h6" />
      <path d="M9 15.5h6" />
    </svg>
  );
}
