import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { routePaths } from "@/app/router";
import { useAuth } from "@/features/auth";
import {
  CommercialDocumentRenderer,
  resolveDocumentMarkdown,
  usePublicCommercialDocumentDecisionMutation,
  usePublicCommercialDocumentQuery
} from "@/modules/documentation";
import { AppIcon, Button } from "@/shared/ui";
import { isApiError } from "@/shared/api/http-client";
import type { PublicCommercialDocument } from "@/pages/proposal-public-page/api/public-commercial-document-service";
import "./proposal-public-page.css";

type LoadState = "loading" | "ready" | "invalid" | "expired" | "revoked" | "error";
type DecisionState = "idle" | "submitting" | "success" | "error";

const finalStatuses = new Set(["approved", "accepted", "signed", "rejected"]);

function normalizeErrorState(error: unknown): LoadState {
  if (!isApiError(error)) {
    return "error";
  }

  const code =
    error.details && typeof error.details === "object"
      ? (error.details as { code?: unknown }).code
      : null;

  if (code === "TOKEN_EXPIRED") return "expired";
  if (code === "TOKEN_REVOKED") return "revoked";
  if (error.status === 404 || code === "TOKEN_INVALID" || code === "DOCUMENT_NOT_SENT") return "invalid";
  return "error";
}

function getDocumentLabel(document: PublicCommercialDocument | null): string {
  if (!document) return "Documento";
  return document.kind === "proposal" ? "Proposta" : "Contrato";
}

function getPositiveDecision(document: PublicCommercialDocument) {
  return document.kind === "proposal"
    ? { action: "approve" as const, label: "Aprovar proposta", nextStatus: "approved" as const }
    : { action: "accept" as const, label: "Aceitar contrato", nextStatus: "accepted" as const };
}

function getPrimaryRecipientEmail(document: PublicCommercialDocument): string {
  return document.recipientEmails?.[0] ?? document.recipientEmail ?? "";
}

function getAuthButtonLabel(document: PublicCommercialDocument, isAuthenticated: boolean): string {
  const recipientEmail = getPrimaryRecipientEmail(document);
  if (!recipientEmail) {
    return isAuthenticated ? "Entrar com o e-mail destinatario" : "Entrar para visualizar";
  }

  return `${document.recipientUserExists ? "Entrar" : "Criar conta"} - ${recipientEmail}`;
}

function buildLoginTarget(pathname: string, search: string, document: PublicCommercialDocument) {
  const returnTo = `${pathname}${search}`;
  const params = new URLSearchParams({ returnTo });
  const recipientEmail = getPrimaryRecipientEmail(document);

  if (recipientEmail) {
    params.set("email", recipientEmail);
  }
  if (recipientEmail && !document.recipientUserExists) {
    params.set("step", "register");
  }
  return `${routePaths.login}?${params.toString()}`;
}

export function ProposalPublicPage() {
  const { token = "" } = useParams<{ token: string }>();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const publicDocumentQuery = usePublicCommercialDocumentQuery(token);
  const publicDecisionMutation = usePublicCommercialDocumentDecisionMutation();
  const [document, setDocument] = useState<PublicCommercialDocument | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [acceptedReading, setAcceptedReading] = useState(false);
  const [decisionState, setDecisionState] = useState<DecisionState>("idle");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.initialized || auth.status === "refreshing" || auth.status === "initializing") {
      return;
    }
    void publicDocumentQuery.refetch();
  }, [auth.initialized, auth.status, auth.user?.email, publicDocumentQuery.refetch]);

  useEffect(() => {
    setDecisionError(null);
    if (publicDocumentQuery.isLoading || publicDocumentQuery.isFetching) {
      setLoadState("loading");
      return;
    }
    if (publicDocumentQuery.data) {
      setDocument(publicDocumentQuery.data);
      setLoadState("ready");
      return;
    }
    if (publicDocumentQuery.error) {
      setDocument(null);
      setLoadState(normalizeErrorState(publicDocumentQuery.error));
    }
  }, [publicDocumentQuery.data, publicDocumentQuery.error, publicDocumentQuery.isFetching, publicDocumentQuery.isLoading]);

  const documentLabel = getDocumentLabel(document);
  const positiveDecision = document ? getPositiveDecision(document) : null;
  const renderedDocument = useMemo(() => {
    if (!document || document.masked) {
      return { markdown: "", diagnostics: [] };
    }
    const resolved = resolveDocumentMarkdown(document.content, {
      document: {
        id: "public",
        workspaceId: "public",
        title: document.title,
        content: document.content,
        kind: document.kind,
        tags: [],
        metadata: document.metadata,
        position: 0,
        createdBy: "",
        updatedBy: null,
        createdAt: "",
        updatedAt: ""
      },
      workspace: {
        id: "public",
        name: document.workspace.name,
        currentUserId: "",
        membersById: {},
        tasks: [],
        boardConfig: { columns: [] },
        automations: [],
        preferences: {}
      } as never
    });
    return {
      ...resolved,
      markdown: resolved.markdown.replace(/!\[Logo do cliente\]\(\s*\)\s*/g, "")
    };
  }, [document]);
  const isFinal = Boolean(document && finalStatuses.has(document.status));
  const isAuthenticatedRecipient = Boolean(
    document &&
      auth.isAuthenticated &&
      (document.recipientEmails?.length
        ? document.recipientEmails.some((email) => email.toLowerCase() === auth.user?.email.toLowerCase())
        : auth.user?.email.toLowerCase() === document.recipientEmail.toLowerCase())
  );
  const needsAuth = Boolean(document && !isAuthenticatedRecipient);

  function goToAuth() {
    if (!document) return;
    navigate(buildLoginTarget(location.pathname, location.search, document), {
      state: {
        from: {
          pathname: location.pathname,
          search: location.search
        }
      }
    });
  }

  async function submitDecision(decision: "approve" | "accept" | "reject") {
    if (!document || decisionState === "submitting" || publicDecisionMutation.isPending) {
      return;
    }

    if (!isAuthenticatedRecipient) {
      goToAuth();
      return;
    }

    if (decision !== "reject" && !acceptedReading) {
      setDecisionError("Confirme que voce leu e aceita os termos antes de continuar.");
      return;
    }

    setDecisionState("submitting");
    setDecisionError(null);

    try {
      await publicDecisionMutation.mutateAsync({ publicAccessId: token, decision });
      setDocument((current) =>
        current
          ? {
              ...current,
              status: decision === "reject" ? "rejected" : getPositiveDecision(current).nextStatus,
              metadata: {
                ...current.metadata,
                status: decision === "reject" ? "rejected" : getPositiveDecision(current).nextStatus
              }
            }
          : current
      );
      setDecisionState("success");
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        publicDecisionMutation.reset();
        goToAuth();
        return;
      }
      setDecisionState("error");
      setDecisionError(error instanceof Error ? error.message : "Nao foi possivel registrar sua decisao.");
    }
  }

  if (loadState !== "ready" || !document) {
    const messages: Record<Exclude<LoadState, "ready">, { title: string; body: string }> = {
      loading: {
        title: "Carregando documento",
        body: "Estamos validando o link seguro recebido por e-mail."
      },
      invalid: {
        title: "Link invalido",
        body: "Nao encontramos um documento enviado com este token."
      },
      expired: {
        title: "Link expirado",
        body: "Este link nao esta mais disponivel. Solicite um novo envio ao responsavel comercial."
      },
      revoked: {
        title: "Link revogado",
        body: "O acesso publico deste documento foi revogado pelo remetente."
      },
      error: {
        title: "Nao foi possivel abrir",
        body: "Tente novamente em instantes ou solicite um novo link."
      }
    };
    const message = messages[loadState === "ready" ? "error" : loadState];

    return (
      <main className="proposal-public-page proposal-public-page--center">
        <section className="proposal-public-page__state-panel">
          <AppIcon name={loadState === "loading" ? "refresh" : "alert-circle"} size={24} />
          <h1>{message.title}</h1>
          <p>{message.body}</p>
          <Link className="proposal-public-page__button proposal-public-page__button--secondary" to={routePaths.home}>
            Voltar ao Dask
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="proposal-public-page">
      <header className="proposal-public-page__header">
        <div>
          <span>{document.workspace.name}</span>
          <h1>{document.title}</h1>
          <p>{documentLabel} em modo somente leitura.</p>
        </div>
        <div className={`proposal-public-page__status proposal-public-page__status--${document.status}`}>
          {document.status}
        </div>
      </header>

      <section className="proposal-public-page__notice">
        <AppIcon name="info" size={18} />
        <p>
          Leia o documento completo antes de tomar uma decisao. O aceite confirma que voce concorda com os termos
          apresentados nesta versao.
        </p>
      </section>

      <div className={`proposal-public-page__layout${document.masked ? " proposal-public-page__layout--full" : ""}`}>
        <article
          className={`proposal-public-page__document markdown-body${document.masked ? " proposal-public-page__document--guarded" : ""}`}
          aria-label={`${documentLabel} para leitura`}
        >
          {!document.masked ? (
            <CommercialDocumentRenderer
              markdown={renderedDocument.markdown.trim().length > 0 ? renderedDocument.markdown : "_Sem conteudo._"}
              diagnostics={renderedDocument.diagnostics}
            />
          ) : null}
          {document.masked && (
            <div className="proposal-public-page__document-guard">
              <div className="proposal-public-page__document-guard-card">
                <AppIcon name="lock" size={22} />
                <p>Documento protegido</p>
                <span>Faça login para visualizar as informações sensíveis deste documento.</span>
                <button className="proposal-public-page__button" onClick={goToAuth}>
                  {getAuthButtonLabel(document, auth.isAuthenticated)}
                </button>
              </div>
            </div>
          )}
        </article>

        {!document.masked && (
          <aside className="proposal-public-page__decision-panel" aria-label="Decisao do documento">
            <div>
              <span>Destinatario</span>
              <strong>{document.recipientEmail}</strong>
            </div>

            {needsAuth && auth.isAuthenticated ? (
              <div className="proposal-public-page__auth-box">
                <p>
                  Para vincular a decisao ao cliente, entre ou crie uma conta com o e-mail destinatario.
                </p>
                <Button variant="primary" onClick={goToAuth}>
                  {document.recipientUserExists ? "Entrar para decidir" : "Criar conta para decidir"}
                </Button>
              </div>
            ) : null}

            {isAuthenticatedRecipient && !isFinal ? (
              <>
                <label className="proposal-public-page__accept-check">
                  <input
                    type="checkbox"
                    checked={acceptedReading}
                    onChange={(event) => setAcceptedReading(event.target.checked)}
                  />
                  <span>Li e aceito os termos deste documento.</span>
                </label>

                {decisionError ? <p className="proposal-public-page__error" role="alert">{decisionError}</p> : null}

                <div className="proposal-public-page__actions">
                  <Button
                    variant="primary"
                    disabled={!acceptedReading || decisionState === "submitting" || publicDecisionMutation.isPending}
                    onClick={() => positiveDecision && void submitDecision(positiveDecision.action)}
                  >
                    {decisionState === "submitting" || publicDecisionMutation.isPending ? "Registrando..." : positiveDecision?.label}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decisionState === "submitting" || publicDecisionMutation.isPending}
                    onClick={() => void submitDecision("reject")}
                  >
                    Recusar
                  </Button>
                </div>
              </>
            ) : null}

            {isFinal ? (
              <p className="proposal-public-page__final-message">
                A decisao deste documento ja foi registrada como <strong>{document.status}</strong>.
              </p>
            ) : null}

            {decisionState === "success" ? (
              <p className="proposal-public-page__success" role="status" aria-live="polite">
                Decisao registrada com sucesso.
              </p>
            ) : null}
          </aside>
        )}
      </div>
    </main>
  );
}
