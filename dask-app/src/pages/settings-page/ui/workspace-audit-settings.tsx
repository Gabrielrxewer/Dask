import { useId, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useCurrentWorkspace, useWorkspaceAuditLogQuery, useWorkspaceSettingsPermissions } from "@/modules/workspace";
import type { WorkspaceAuditEvent } from "@/modules/workspace/model";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui";
import "./workspace-audit-settings.css";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function readEventMetadata(event: WorkspaceAuditEvent): Record<string, unknown> {
  return event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
    ? event.metadata
    : {};
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatEventLabel(event: WorkspaceAuditEvent): string {
  const metadata = readEventMetadata(event);
  const entityType = readString(metadata.entityType, "config");
  const action = readString(metadata.action, event.eventName.split(".").at(-1) ?? "update");
  return `${entityType.replace(/_/g, " ")} / ${action.replace(/_/g, " ")}`;
}

function formatEventSummary(event: WorkspaceAuditEvent): string {
  const metadata = readEventMetadata(event);
  const entityId = readString(metadata.entityId);
  const suffix = entityId ? ` (${entityId.slice(0, 8)})` : "";
  return `${event.eventName}${suffix}`;
}

function AuditEventDetails({ event }: { event: WorkspaceAuditEvent }) {
  const [isOpen, setIsOpen] = useState(false);
  const payloadId = useId();
  const metadata = readEventMetadata(event);
  const before = metadata.before;
  const after = metadata.after;

  return (
    <div className="workspace-audit__details">
      <button
        type="button"
        className="workspace-audit__details-trigger"
        aria-expanded={isOpen}
        aria-controls={payloadId}
        onClick={() => setIsOpen(current => !current)}
      >
        {isOpen ? "Ocultar payload" : "Ver payload"}
      </button>
      {isOpen ? (
        <div id={payloadId} className="workspace-audit__payload-grid" role="region" aria-label="Payload do evento">
          <div>
            <strong>Antes</strong>
            <pre>{before === undefined ? "{}" : JSON.stringify(before, null, 2)}</pre>
          </div>
          <div>
            <strong>Depois</strong>
            <pre>{after === undefined ? "{}" : JSON.stringify(after, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuditLogList({ events }: { events: WorkspaceAuditEvent[] }) {
  return (
    <ol className="workspace-audit__list">
      {events.map((event) => (
        <li key={event.id} className="workspace-audit__event">
          <div className="workspace-audit__event-main">
            <span className="workspace-audit__severity">{event.severity.toLowerCase()}</span>
            <div>
              <h3>{formatEventLabel(event)}</h3>
              <p>{formatEventSummary(event)}</p>
            </div>
          </div>
          <div className="workspace-audit__event-meta">
            <span>{formatDateTime(event.happenedAt)}</span>
            {event.actorId && <span>ator {event.actorId.slice(0, 8)}</span>}
          </div>
          <AuditEventDetails event={event} />
        </li>
      ))}
    </ol>
  );
}

export function WorkspaceAuditSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useCurrentWorkspace();
  const permissions = useWorkspaceSettingsPermissions(workspaceSlug, snapshot);
  const auditQuery = useWorkspaceAuditLogQuery(workspaceSlug, { limit: 100 }, { enabled: permissions.canReadAudit });
  const events = auditQuery.data ?? [];
  const configEvents = useMemo(
    () => events.filter((event) => event.eventName.startsWith("workspace_config.")),
    [events]
  );

  return (
    <section className="workspace-audit">
      <header className="workspace-audit__header">
        <div>
          <p className="workspace-audit__eyebrow">Auditoria</p>
          <h1>Historico de configuracao</h1>
          <p>
            Alteracoes em estados, colunas e campos do workspace
            {snapshot?.name ? ` ${snapshot.name}` : ""}.
          </p>
        </div>
        <button
          type="button"
          className="workspace-audit__refresh"
          onClick={() => void auditQuery.refetch()}
          disabled={!permissions.canReadAudit || auditQuery.isFetching}
        >
          {auditQuery.isFetching ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {!permissions.canReadAudit && !permissions.isLoading && (
        <EmptyState
          title="Auditoria restrita"
          description="Apenas proprietarios e admins podem visualizar eventos de auditoria."
        />
      )}
      {auditQuery.isLoading && <LoadingState text="Carregando auditoria..." variant="frame" />}
      {permissions.canReadAudit && auditQuery.isError && (
        <ErrorState
          title="Nao foi possivel carregar a auditoria"
          description="A auditoria nao bloqueia o uso do board, mas vale tentar novamente antes de publicar mudancas importantes."
          onRetry={() => void auditQuery.refetch()}
        />
      )}
      {permissions.canReadAudit && !auditQuery.isLoading && !auditQuery.isError && configEvents.length === 0 && (
        <EmptyState
          title="Nenhum evento de configuracao ainda"
          description="Criacoes e alteracoes de estados, colunas e campos vao aparecer aqui."
        />
      )}
      {permissions.canReadAudit && configEvents.length > 0 && <AuditLogList events={configEvents} />}
    </section>
  );
}
