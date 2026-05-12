import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { routePaths, buildWorkspaceBillingPath } from "@/app/router";
import { useAuth } from "@/features/auth";
import { Button, LoadingState } from "@/shared/ui";
import { isApiError } from "@/shared/api/http-client";
import { useBillingPortalOnboardMutation } from "../model/use-billing-portal-onboard-mutation";
import "./billing-public-page.css";

type PortalState = "checking-auth" | "linking" | "ready" | "invalid" | "forbidden" | "error";

function buildLoginPath(returnTo: string): string {
  const params = new URLSearchParams({
    returnTo
  });
  return `${routePaths.login}?${params.toString()}`;
}

export function BillingPublicPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PortalState>("checking-auth");
  const { mutateAsync: onboardBillingToken } = useBillingPortalOnboardMutation();

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    if (!auth.initialized || auth.status === "initializing") {
      setState("checking-auth");
      return;
    }

    const returnTo = `${location.pathname}${location.search}`;
    if (!auth.isAuthenticated) {
      navigate(buildLoginPath(returnTo), {
        replace: true,
        state: {
          from: {
            pathname: location.pathname,
            search: location.search
          }
        }
      });
      return;
    }

    let active = true;
    setState("linking");
    onboardBillingToken(token)
      .then((response) => {
        if (!active) return;
        const params = new URLSearchParams({
          portal: "cliente"
        });
        if (response.orderId) {
          params.set("orderId", response.orderId);
        }
        setState("ready");
        navigate(`${buildWorkspaceBillingPath(response.workspaceSlug)}?${params.toString()}`, { replace: true });
      })
      .catch((error) => {
        if (!active) return;
        if (isApiError(error) && error.status === 403) {
          setState("forbidden");
          return;
        }
        if (isApiError(error) && error.status === 404) {
          setState("invalid");
          return;
        }
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [
    auth.initialized,
    auth.isAuthenticated,
    auth.status,
    location.pathname,
    location.search,
    navigate,
    onboardBillingToken,
    token
  ]);

  if (state === "checking-auth" || state === "linking" || state === "ready") {
    return (
      <main className="billing-public-page">
        <LoadingState text={state === "linking" ? "Vinculando cobranca ao seu portal..." : "Abrindo cobranca..."} />
      </main>
    );
  }

  const message =
    state === "forbidden"
      ? {
          title: "E-mail diferente",
          body: "Entre com a conta do e-mail que recebeu esta cobranca para liberar o portal do cliente."
        }
      : state === "invalid"
        ? {
            title: "Link invalido",
            body: "Nao encontramos uma cobranca ativa para este link."
          }
        : {
            title: "Nao foi possivel abrir",
            body: "Tente novamente em instantes ou solicite um novo link para a empresa."
          };

  return (
    <main className="billing-public-page">
      <section className="billing-public-page__panel">
        <h1>{message.title}</h1>
        <p>{message.body}</p>
        <div className="billing-public-page__actions">
          <Button type="button" variant="primary" onClick={() => navigate(routePaths.login)}>
            Entrar novamente
          </Button>
          <Link to={routePaths.home}>Voltar ao Dask</Link>
        </div>
      </section>
    </main>
  );
}
