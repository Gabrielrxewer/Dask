import type { WorkspaceModuleKey } from "@/modules/workspace/model";
import { MODULE_KEYS, MODULE_META } from "./members-settings.model";

export function ModulePicker({
  selected,
  onChange,
  disabled = false,
}: {
  selected: WorkspaceModuleKey[];
  onChange: (keys: WorkspaceModuleKey[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: WorkspaceModuleKey) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };
  return (
    <div className="ms-module-picker">
      {MODULE_KEYS.map(key => (
        <button
          key={key}
          type="button"
          className={`ms-module-chip${selected.includes(key) ? " ms-module-chip--active" : ""}`}
          onClick={() => toggle(key)}
          disabled={disabled}
        >
          {MODULE_META[key].label}
        </button>
      ))}
    </div>
  );
}
