type TabId = string;

interface TabsItem {
  id: TabId;
  label: string;
}

interface TabsProps {
  value: TabId;
  items: TabsItem[];
  onChange: (id: TabId) => void;
  className?: string;
}

export function Tabs({ value, items, onChange, className = "" }: TabsProps) {
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
