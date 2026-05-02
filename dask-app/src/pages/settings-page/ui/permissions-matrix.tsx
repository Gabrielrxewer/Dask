import { useState } from "react";
import type { WorkspaceAccessControlSnapshot } from "@/modules/workspace/model";
import { TextInput } from "@/shared/ui";
import { groupedPermissions, MATRIX_ROLES, ROLE_LABELS } from "./members-settings.model";

export function PermissionsMatrix({ accessControl }: { accessControl: WorkspaceAccessControlSnapshot }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = search
    ? accessControl.catalog.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : accessControl.catalog;
  const groups = groupedPermissions(filtered);

  const toggleCollapse = (label: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="ms-matrix">
      <div className="ms-matrix__search">
        <TextInput
          value={search}
          placeholder="Buscar permissão..."
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="ms-matrix__wrap">
        <div className="ms-matrix__table">
          <div className="ms-matrix__header">
            <div className="ms-matrix__perm-col">Permissão</div>
            {MATRIX_ROLES.map(role => (
              <div key={role} className="ms-matrix__role-col">{ROLE_LABELS[role]}</div>
            ))}
          </div>
          {groups.map(({ label, keys }) => (
            <div key={label} className="ms-matrix__group">
              <button
                type="button"
                className="ms-matrix__group-header"
                onClick={() => toggleCollapse(label)}
              >
                <span className="ms-matrix__group-chevron">
                  {collapsed.has(label) ? "▶" : "▼"}
                </span>
                <span>{label}</span>
                <span className="ms-badge">{keys.length}</span>
              </button>
              {!collapsed.has(label) && keys.map(permission => (
                <div key={permission} className="ms-matrix__row">
                  <div className="ms-matrix__perm-col">{permission}</div>
                  {MATRIX_ROLES.map(role => {
                    const has = accessControl.rolePresets[role]?.includes(permission) === true;
                    return (
                      <div
                        key={role}
                        className={`ms-matrix__role-col ms-matrix__cell ${has ? "ms-matrix__cell--yes" : "ms-matrix__cell--no"}`}
                      >
                        {has ? "✓" : "—"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MembersSettings (main) ───────────────────────────────────────────────────
