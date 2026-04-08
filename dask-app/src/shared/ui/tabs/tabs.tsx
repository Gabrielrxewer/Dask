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
    <div className={`shared-tabs ${className}`.trim()}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`shared-tabs__item ${value === item.id ? "shared-tabs__item--active" : ""}`.trim()}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
