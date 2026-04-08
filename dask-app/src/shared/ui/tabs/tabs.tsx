import { cn } from "@/shared/lib/cn";

interface TabsItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  value: T;
  items: Array<TabsItem<T>>;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ value, items, onChange, className = "" }: TabsProps<T>) {
  return (
    <div className={cn("shared-tabs", className)}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={cn("shared-tabs__item", value === item.id && "shared-tabs__item--active")}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
