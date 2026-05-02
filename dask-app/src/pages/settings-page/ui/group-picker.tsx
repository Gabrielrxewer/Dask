import type { WorkspaceAccessGroup } from "@/modules/workspace/model";

export function GroupPicker({
  groups,
  selected,
  onChange,
  disabled = false,
}: {
  groups: WorkspaceAccessGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(g => g !== id) : [...selected, id]);
  };
  if (groups.length === 0) {
    return <p className="ms-hint">Nenhum grupo de acesso criado ainda.</p>;
  }
  return (
    <div className="ms-group-picker">
      {groups.map(group => (
        <label key={group.id} className="ms-group-picker__item">
          <input
            type="checkbox"
            checked={selected.includes(group.id)}
            onChange={() => toggle(group.id)}
            disabled={disabled}
          />
          <div className="ms-group-picker__info">
            <strong>{group.name}</strong>
            {group.description && <span>{group.description}</span>}
          </div>
        </label>
      ))}
    </div>
  );
}
