import type { WorkspaceBoardMode, WorkspaceDateFormat, WorkspacePreferences } from "@/modules/workspace/model/types";

interface WorkspaceOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface WorkspaceBoardModeOption extends WorkspaceOption<WorkspaceBoardMode> {
  caption: string;
}

export const defaultWorkspacePreferences: WorkspacePreferences = {
  defaultBoardMode: "dev",
  dateFormat: "dd/mm/yyyy",
  visibleCardFieldIds: []
};

export const workspaceBoardModeOptions: WorkspaceBoardModeOption[] = [
  { value: "dev", label: "Dev", caption: "Fluxo operacional principal" },
  { value: "po", label: "PO", caption: "Priorizacao e compromisso" },
  { value: "manager", label: "Gestao", caption: "Visao de capacidade e risco" },
  { value: "qa", label: "QA", caption: "Validacao e conformidade" }
];

export const workspaceDateFormatOptions: Array<WorkspaceOption<WorkspaceDateFormat>> = [
  { value: "dd/mm/yyyy", label: "DD/MM/YYYY" },
  { value: "mm/dd/yyyy", label: "MM/DD/YYYY" }
];
