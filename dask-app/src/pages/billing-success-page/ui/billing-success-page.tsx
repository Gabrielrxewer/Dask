import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router";
import { billingService, billingStore } from "@/modules/billing";
import { LoadingState } from "@/shared/ui";
import "./billing-success-page.css";

type PageState = "loading" | "active" | "pending";

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2500;

export function BillingSuccessPage() {
  const [state, setState] = useState<PageState>("loading");
  const pollCount = useRef(0);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const status = await billingService.getStatus();

        if (!active) return;

        if (status.canAccessPlatform) {
          billingStore.setStatus(status);
          setState("active");
          return;
        }

        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          // Webhook may be delayed — show pending message
          setState("pending");
          return;
        }

        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!active) return;
        setState("pending");
      }
    }

    poll();

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="billing-success">
        <LoadingState text="Confirmando seu pagamento" animation="billing" />
      </main>
    );
  }

  if (state === "active") {
    return (
      <main className="billing-success">
        <div className="billing-success__check-wrap">
          <svg className="billing-success__check-svg" viewBox="0 0 52 52" fill="none" aria-hidden="true">
            <circle className="billing-success__check-circle" cx="26" cy="26" r="24" />
            <polyline className="billing-success__check-mark" points="14,27 22,35 38,19" />
          </svg>
        </div>
        <h1 className="billing-success__title">Assinatura ativa!</h1>
        <p className="billing-success__description">
          Seu pagamento foi confirmado. Você tem acesso completo à plataforma Dask.
        </p>
        <div className="billing-success__actions">
          <Link className="billing-success__btn billing-success__btn--primary" to={routePaths.workspaceEntry}>
            Acessar a plataforma
          </Link>
        </div>
      </main>
    );
  }

  // pending: webhook may arrive later
  return (
    <main className="billing-success">
      <div className="billing-success__icon billing-success__icon--pending">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="billing-success__title">Pagamento em processamento</h1>
      <p className="billing-success__description">
        Seu pagamento está sendo processado. A ativação pode levar alguns instantes. Se já foi cobrado, acesse a
        plataforma e aguarde a confirmação automática.
      </p>
      <div className="billing-success__actions">
        <Link className="billing-success__btn billing-success__btn--primary" to={routePaths.workspaceEntry}>
          Tentar acessar a plataforma
        </Link>
        <Link className="billing-success__btn billing-success__btn--secondary" to={routePaths.choosePlan}>
          Voltar aos planos
        </Link>
      </div>
    </main>
  );
}
