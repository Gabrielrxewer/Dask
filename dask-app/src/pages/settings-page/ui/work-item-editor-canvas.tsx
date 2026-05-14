import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, Dispatch, PointerEvent, ReactNode, SetStateAction, WheelEvent } from "react";
import { LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { getTaskFieldTypeLabel } from "@/entities/task/model/card-fields";
import { TaskCard } from "@/entities/task/ui/task-card";
import type {
  BoardConfig,
  Task,
  TaskCardDebugSnapshot,
  TaskFieldDefinition
} from "@/entities/task";
import type { ApiItemType } from "@/modules/workspace/model";
import type { DetailZone, EditorDropTarget } from "@/pages/settings-page/model/work-item-layout-editor";
import { EmptyState } from "@/shared/ui";
import {
  PREVIEW_CARD_DESCRIPTION,
  PREVIEW_CARD_TITLE,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";
import { WorkItemFieldPreviewValue } from "./work-item-field-preview-value";

const CARD_CANVAS_DEFAULT_ZOOM = 1;
const CARD_CANVAS_MIN_ZOOM = 0.68;
const CARD_CANVAS_MAX_ZOOM = 1.7;
const CARD_CANVAS_ZOOM_STEP = 0.12;

function clampCardCanvasZoom(value: number): number {
  return Math.min(CARD_CANVAS_MAX_ZOOM, Math.max(CARD_CANVAS_MIN_ZOOM, value));
}

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
  getCardPreviewFieldDragConfig: NonNullable<ComponentProps<typeof TaskCard>["getFieldDragConfig"]>;
  getCardPreviewFieldDropConfig: NonNullable<ComponentProps<typeof TaskCard>["getFieldDropConfig"]>;
  renderCardEmptySlot: NonNullable<ComponentProps<typeof TaskCard>["renderEmptySlot"]>;
  renderDetailInsertTarget: (zone: DetailZone, index: number) => ReactNode;
  renderDetailFieldCard: (field: FieldLibraryItem, zone: DetailZone, index: number) => ReactNode;
  onClearSelectedField: () => void;
  onDebugSnapshot: (snapshot: TaskCardDebugSnapshot | null) => void;
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
  getCardPreviewFieldDragConfig,
  getCardPreviewFieldDropConfig,
  renderCardEmptySlot,
  renderDetailInsertTarget,
  renderDetailFieldCard,
  onClearSelectedField,
  onDebugSnapshot
}: WorkItemEditorCanvasProps) {
  const [cardCanvasZoom, setCardCanvasZoom] = useState(CARD_CANVAS_DEFAULT_ZOOM);
  const [cardCanvasPan, setCardCanvasPan] = useState({ x: 0, y: 0 });
  const [isCardCanvasPanning, setIsCardCanvasPanning] = useState(false);
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const zoomLabel = `${Math.round(cardCanvasZoom * 100)}%`;

  const resetCardCanvas = useCallback(() => {
    setCardCanvasZoom(CARD_CANVAS_DEFAULT_ZOOM);
    setCardCanvasPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (activeCanvasTab === "card") {
      resetCardCanvas();
    }
  }, [activeCanvasTab, resetCardCanvas]);

  const updateCardCanvasZoom = useCallback((delta: number) => {
    setCardCanvasZoom((current) => clampCardCanvasZoom(current + delta));
  }, []);

  const handleCardCanvasWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    updateCardCanvasZoom(event.deltaY > 0 ? -CARD_CANVAS_ZOOM_STEP : CARD_CANVAS_ZOOM_STEP);
  }, [updateCardCanvasZoom]);

  const handleCardCanvasPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget || isDragging) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsCardCanvasPanning(true);
    panStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: cardCanvasPan.x,
      panY: cardCanvasPan.y
    };
  }, [cardCanvasPan.x, cardCanvasPan.y, isDragging]);

  const handleCardCanvasPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const panStart = panStartRef.current;
    if (!panStart || panStart.pointerId !== event.pointerId) return;
    setCardCanvasPan({
      x: panStart.panX + event.clientX - panStart.x,
      y: panStart.panY + event.clientY - panStart.y
    });
  }, []);

  const handleCardCanvasPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (panStartRef.current?.pointerId === event.pointerId) {
      panStartRef.current = null;
      setIsCardCanvasPanning(false);
    }
  }, []);

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
        <div className="wie__card-canvas-toolbar" aria-label="Controles de zoom do card">
          <button type="button" className="wie__card-canvas-btn" onClick={() => updateCardCanvasZoom(-CARD_CANVAS_ZOOM_STEP)} aria-label="Diminuir zoom">
            <ZoomOut size={15} strokeWidth={2.2} />
          </button>
          <span className="wie__card-canvas-zoom">{zoomLabel}</span>
          <button type="button" className="wie__card-canvas-btn" onClick={() => updateCardCanvasZoom(CARD_CANVAS_ZOOM_STEP)} aria-label="Aumentar zoom">
            <ZoomIn size={15} strokeWidth={2.2} />
          </button>
          <button type="button" className="wie__card-canvas-btn" onClick={resetCardCanvas} aria-label="Centralizar card">
            <LocateFixed size={15} strokeWidth={2.2} />
          </button>
        </div>
        <div
          className={`wie__card-stage${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
          data-panning={isCardCanvasPanning ? "true" : undefined}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClearSelectedField();
            }
          }}
          onWheel={handleCardCanvasWheel}
          onPointerDown={handleCardCanvasPointerDown}
          onPointerMove={handleCardCanvasPointerMove}
          onPointerUp={handleCardCanvasPointerUp}
          onPointerCancel={handleCardCanvasPointerUp}
        >
          <div
            className="wie__card-canvas-content"
            style={{
              transform: `translate3d(${cardCanvasPan.x}px, ${cardCanvasPan.y}px, 0) scale(${cardCanvasZoom})`
            }}
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
              getFieldSlotProps={getCardPreviewFieldProps}
              getFieldDragConfig={getCardPreviewFieldDragConfig}
              getFieldDropConfig={getCardPreviewFieldDropConfig}
              renderEmptySlot={renderCardEmptySlot}
              onDebugSnapshot={onDebugSnapshot}
            />
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
            >
              <div className="wie__form-zone-head">
                <span>Coluna principal</span>
                <strong>{detailMainFields.length} campo{detailMainFields.length !== 1 ? "s" : ""}</strong>
              </div>
              {detailMainFields.length === 0 ? (
                isDragging ? renderDetailInsertTarget("main", 0) : <EmptyState className="wie__form-zone-empty" size="compact">Arraste campos para a coluna principal.</EmptyState>
              ) : (
                <>
                  {detailMainFields.map((field, index) => (
                    <div key={field.id} className="wie__detail-field-key">
                      {renderDetailFieldCard(field, "main", index)}
                    </div>
                  ))}
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
            >
              <div className="wie__form-zone-head">
                <span>Barra lateral</span>
                <strong>{detailSideFields.length} campo{detailSideFields.length !== 1 ? "s" : ""}</strong>
              </div>
              {detailSideFields.length === 0 ? (
                isDragging ? renderDetailInsertTarget("side", 0) : <EmptyState className="wie__form-zone-empty" size="compact">Arraste campos de apoio e metadados para a lateral.</EmptyState>
              ) : (
                <>
                  {detailSideFields.map((field, index) => (
                    <div key={field.id} className="wie__detail-field-key">
                      {renderDetailFieldCard(field, "side", index)}
                    </div>
                  ))}
                  {isDragging ? renderDetailInsertTarget("side", detailSideFields.length) : null}
                </>
              )}
            </div>
          </aside>
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
                <div className="wie__field-editor-preview-field" data-field-type={activeFieldCanvasPreview.type}>
                  <WorkItemFieldPreviewValue
                    field={activeFieldCanvasPreview}
                    previewTask={previewTask}
                    boardConfig={previewBoardConfig}
                    statuses={previewRuntimeStatuses ?? []}
                    membersById={previewMembersById}
                  />
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
