import { useState } from "react";
import type { WorkspacePermissionKey } from "@/modules/workspace/model";
import { TextInput } from "@/shared/ui";
import { groupedPermissions } from "./members-settings.model";

export function PermissionPicker({
  catalog,
  selected,
  onChange,
  disabled = false,
}: {
  catalog: WorkspacePermissionKey[];
  selected: WorkspacePermissionKey[];
  onChange: (keys: WorkspacePermissionKey[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = search ? catalog.filter(k => k.includes(search.toLowerCase())) : catalog;
  const groups = groupedPermissions(filtered);

  const toggle = (key: WorkspacePermissionKey) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  return (
    <div className="ms-perm-picker">
      <div className="ms-perm-picker__search">
        <TextInput value={search} placeholder="Buscar permissão..." onChange={e => setSearch(e.target.value)} />
      </div>
      {selected.length > 0 && (
        <div className="ms-chips">
          {selected.map(key => (
            <span key={key} className="ms-chip">
              {key}
              {!disabled && (
                <button
                  type="button"
                  className="ms-chip__remove"
                  onClick={() => toggle(key)}
                  aria-label={`Remover ${key}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="ms-perm-picker__list">
        {groups.length === 0 ? (
          <p className="ms-hint">Nenhuma permissão encontrada.</p>
        ) : (
          groups.map(({ label, keys }) => (
            <div key={label} className="ms-perm-picker__group">
              <p className="ms-perm-picker__group-label">{label}</p>
              {keys.map(key => (
                <label key={key} className="ms-perm-picker__item">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => toggle(key)}
                    disabled={disabled}
                  />
                  <span>{key}</span>
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
