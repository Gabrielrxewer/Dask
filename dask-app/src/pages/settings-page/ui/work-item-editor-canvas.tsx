import type { ComponentProps, Dispatch, DragEvent, MouseEvent, ReactNode, SetStateAction } from "react";
import { getTaskFieldTypeLabel, TaskCard } from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCardDebugSnapshot,
  TaskFieldDefinition
} from "@/entities/task";
import type { ApiItemType } from "@/modules/workspace/model";
import type { DetailZone, EditorDropTarget, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";
import { EmptyState } from "@/shared/ui";
import {
  PREVIEW_CARD_DESCRIPTION,
  PREVIEW_CARD_TITLE,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";
import { WorkItemFieldPreviewValue } from "./work-item-field-preview-value";

interface WorkItemEditorCanvasProps {
  activeCanvasTab: "card" | "detail" | "field";
  setActiveCanvasTab: Dispatch<SetStateAction<"card" | "detail" | "field">>;
  cardFields: FieldLibraryItem[];
  detailFields: FieldLibraryItem[];
  detailMainFields: FieldLibraryItem[];
  detailSideFields: FieldLibraryItem[];
  selectedFieldId: string | null;
  selectedInCard: boolean;
  selectedInDetail: boolean;
  pendingFieldSetup: unknown;
  activeFieldCanvasPreview: TaskFieldDefinition | null;
  activeType: ApiItemType | null;
  typeColor: string;
  previewStatusLabel: string;
  previewTask: Task;
  previewBoardConfig: BoardConfig;
  previewMembersById: ComponentProps<typeof TaskCard>["membersById"];
  previewRuntimeStatuses: ComponentProps<typeof TaskCard>["displayStatuses"];
  isDragging: boolean;
  isDraggingType: boolean;
  dropTarget: EditorDropTarget | null;
  getCardPreviewFieldProps: NonNullable<ComponentProps<typeof TaskCard>["getFieldSlotProps"]>;
  renderCardEmptySlot: NonNullable<ComponentProps<typeof TaskCard>["renderEmptySlot"]>;
  renderDetailInsertTarget: (zone: DetailZone, index: number) => ReactNode;
  renderDetailFieldCard: (field: FieldLibraryItem, zone: DetailZone, index: number) => ReactNode;
  onPreviewSurfaceDragOver: (event: DragEvent<HTMLElement>) => void;
  onSurfaceDragLeave: (surface: LayoutScope) => (event: DragEvent<HTMLElement>) => void;
  onApplyResolvedDropTarget: (target: EditorDropTarget) => void;
  onDragEnd: () => void;
  onClearSelectedField: () => void;
  onDebugSnapshot: (snapshot: TaskCardDebugSnapshot | null) => void;
  onDetailZoneDragOver: (event: DragEvent<HTMLElement>, zone: DetailZone, index: number) => void;
  onDetailZoneMouseMove: (event: MouseEvent<HTMLElement>, zone: DetailZone, index: number) => void;
}

export function WorkItemEditorCanvas({
  activeCanvasTab,
  setActiveCanvasTab,
  cardFields,
  detailFields,
  detailMainFields,
  detailSideFields,
  selectedFieldId,
  selectedInCard,
  selectedInDetail,
  pendingFieldSetup,
  activeFieldCanvasPreview,
  activeType,
  typeColor,
  previewStatusLabel,
  previewTask,
  previewBoardConfig,
  previewMembersById,
  previewRuntimeStatuses,
  isDragging,
  isDraggingType,
  dropTarget,
  getCardPreviewFieldProps,
  renderCardEmptySlot,
  renderDetailInsertTarget,
  renderDetailFieldCard,
  onPreviewSurfaceDragOver,
  onSurfaceDragLeave,
  onApplyResolvedDropTarget,
  onDragEnd,
  onClearSelectedField,
  onDebugSnapshot,
  onDetailZoneDragOver,
  onDetailZoneMouseMove
}: WorkItemEditorCanvasProps) {
  return (
    <div className="wie__canvas">
      <div className="wie__canvas-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeCanvasTab === "card"}
          className={`wie__canvas-tab${activeCanvasTab === "card" ? " is-active" : ""}`}
          onClick={() => setActiveCanvasTab("card")}
        >
          Card do board
          {cardFields.length > 0 ? <span className="wie__canvas-tab-count">{cardFields.length}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCanvasTab === "detail"}
          className={`wie__canvas-tab${activeCanvasTab === "detail" ? " is-active" : ""}`}
          onClick={() => setActiveCanvasTab("detail")}
        >
          Formulario expandido
          {detailFields.length > 0 ? <span className="wie__canvas-tab-count">{detailFields.length}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCanvasTab === "field"}
          className={`wie__canvas-tab${activeCanvasTab === "field" ? " is-active" : ""}`}
          onClick={() => setActiveCanvasTab("field")}
        >
          Campos
          {selectedFieldId ? <span className="wie__canvas-tab-count">1</span> : null}
        </button>
      </div>

      <section className={`wie__canvas-panel wie__canvas-panel--card${activeCanvasTab === "card" ? "" : " is-hidden"}`}>
        <div
          className={`wie__card-stage${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
          onDragOver={onPreviewSurfaceDragOver}
          onDragLeave={onSurfaceDragLeave("card")}
          onDrop={(event) => {
            event.preventDefault();
            if (dropTarget?.surface === "card") {
              onApplyResolvedDropTarget(dropTarget);
            }
          }}
          onClick={onClearSelectedField}
        >
          <TaskCard
            task={previewTask}
            boardConfig={previewBoardConfig}
            ignoreSlotLimits
            contextualDisplay={{
              suppressCreatedByWhenAssigneeVisible: true
            }}
            membersById={previewMembersById}
            displayStatuses={previewRuntimeStatuses}
            draggable={false}
            getFieldSlotProps={getCardPreviewFieldProps}
            renderEmptySlot={renderCardEmptySlot}
            onDebugSnapshot={onDebugSnapshot}
            onDragStart={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
            onDragEnd={onDragEnd}
          />
          <div className={`wie__stage-hint${isDragging ? " is-visible" : ""}`}>
            {isDraggingType
              ? "Solte em uma vaga para criar ou em um campo para substituir."
              : "Passe sobre uma vaga para inserir ou sobre um campo para substituir."}
          </div>
        </div>
      </section>

      <section className={`wie__canvas-panel${activeCanvasTab === "detail" ? "" : " is-hidden"}`}>
        <div className="wie__form-stage">
          <div className="wie__form-column">
            <div className="wie__form-hero">
              <div className="wie__form-hero-accent" style={{ background: typeColor }} />
              <div className="wie__form-hero-copy">
                <span>{activeType?.name ?? "Tipo"}</span>
                <h3>{PREVIEW_CARD_TITLE}</h3>
                <p>{PREVIEW_CARD_DESCRIPTION}</p>
              </div>
            </div>
            <div
              className={`wie__form-zone${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
              onDragOver={(event) => onDetailZoneDragOver(event, "main", detailMainFields.length)}
              onMouseMove={(event) => onDetailZoneMouseMove(event, "main", detailMainFields.length)}
              onDragLeave={onSurfaceDragLeave("detail")}
              onDrop={(event) => {
                event.preventDefault();
                if (dropTarget?.surface === "detail" && dropTarget.zone === "main") {
                  onApplyResolvedDropTarget(dropTarget);
                }
              }}
            >
              <div className="wie__form-zone-head">
                <span>Coluna principal</span>
                <strong>{detailMainFields.length} campo{detailMainFields.length !== 1 ? "s" : ""}</strong>
              </div>
              {detailMainFields.length === 0 ? (
                isDragging ? renderDetailInsertTarget("main", 0) : <EmptyState className="wie__form-zone-empty" size="compact">Arraste campos para a coluna principal.</EmptyState>
              ) : (
                <>
                  {detailMainFields.map((field, index) => renderDetailFieldCard(field, "main", index))}
                  {isDragging ? renderDetailInsertTarget("main", detailMainFields.length) : null}
                </>
              )}
            </div>
          </div>

          <aside className="wie__form-sidebar">
            <div className="wie__form-summary-panel">
              <span className="wie__form-eyebrow">Resumo</span>
              <div className="wie__form-summary-chips">
                <span>{activeType?.name ?? "Tipo"}</span>
                <span>{previewStatusLabel}</span>
                <span>{detailFields.length} campos</span>
              </div>
            </div>
            <div
              className={`wie__form-zone is-side${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
              onDragOver={(event) => onDetailZoneDragOver(event, "side", detailSideFields.length)}
              onMouseMove={(event) => onDetailZoneMouseMove(event, "side", detailSideFields.length)}
              onDragLeave={onSurfaceDragLeave("detail")}
              onDrop={(event) => {
                event.preventDefault();
                if (dropTarget?.surface === "detail" && dropTarget.zone === "side") {
                  onApplyResolvedDropTarget(dropTarget);
                }
              }}
            >
              <div className="wie__form-zone-head">
                <span>Barra lateral</span>
                <strong>{detailSideFields.length} campo{detailSideFields.length !== 1 ? "s" : ""}</strong>
              </div>
              {detailSideFields.length === 0 ? (
                isDragging ? renderDetailInsertTarget("side", 0) : <EmptyState className="wie__form-zone-empty" size="compact">Arraste campos de apoio e metadados para a lateral.</EmptyState>
              ) : (
                <>
                  {detailSideFields.map((field, index) => renderDetailFieldCard(field, "side", index))}
                  {isDragging ? renderDetailInsertTarget("side", detailSideFields.length) : null}
                </>
              )}
            </div>
          </aside>
        </div>
        <div className={`wie__stage-hint${isDragging ? " is-visible" : ""}`}>
          {isDraggingType
            ? "Solte em uma vaga para criar ou em um campo para substituir."
            : "Solte em uma vaga para inserir ou em um campo para substituir."}
        </div>
      </section>

      <section className={`wie__canvas-panel wie__canvas-panel--field${activeCanvasTab === "field" ? "" : " is-hidden"}`}>
        <div className="wie__field-editor-stage">
          {activeFieldCanvasPreview ? (
            <div className="wie__field-editor-preview-panel">
              <div className="wie__field-editor-preview-head">
                <span>Preview do campo</span>
                <strong>{activeFieldCanvasPreview.label}</strong>
              </div>
              <div className="wie__field-editor-preview-card">
                <div className="wie__field-editor-preview-meta">
                  <span className="wie__field-editor-preview-type">
                    {getTaskFieldTypeLabel(activeFieldCanvasPreview)}
                  </span>
                  <div className="wie__field-editor-preview-badges">
                    {pendingFieldSetup ? <span>Novo campo</span> : null}
                    {!pendingFieldSetup && selectedInCard ? <span>No card</span> : null}
                    {!pendingFieldSetup && selectedInDetail ? <span>No formulario</span> : null}
                    {!pendingFieldSetup && !selectedInCard && !selectedInDetail ? <span>Fora do layout</span> : null}
                  </div>
                </div>
                <div className="wie__field-editor-preview-field">
                  <label>{activeFieldCanvasPreview.label}</label>
                  <WorkItemFieldPreviewValue field={activeFieldCanvasPreview} />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              className="wie__field-editor-empty"
              title="Campos"
              description="Selecione um campo para editar visualmente. Clique em um campo na biblioteca, no card ou no formulario para abrir o preview e a edicao aqui."
            />
          )}
        </div>
      </section>
    </div>
  );
}
