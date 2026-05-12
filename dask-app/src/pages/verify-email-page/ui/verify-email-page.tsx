import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, LoadingState } from "@/shared/ui";
import { useResendVerificationEmailMutation, verifyEmailOnce } from "@/features/auth";
import { routePaths } from "@/app/router";
import "./verify-email-page.css";

type VerifyStatus = "idle" | "verifying" | "success" | "error";
type ResendStatus = "idle" | "loading" | "sent" | "error";

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resendVerificationEmailMutation = useResendVerificationEmailMutation();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";
  const returnTo = searchParams.get("returnTo") ?? "";

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // If token is present, confirm it automatically on mount
  useEffect(() => {
    if (!token) return;

    let active = true;
    setVerifyStatus("verifying");

    verifyEmailOnce(token)
      .then(() => {
        if (active) setVerifyStatus("success");
      })
      .catch(() => {
        if (active) {
          setVerifyStatus("error");
          setVerifyError(
            "Este link de verificacao e invalido ou ja foi utilizado. Solicite um novo link abaixo."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleResend = async () => {
    if (!email || resendStatus === "loading" || resendStatus === "sent") return;

    setResendStatus("loading");
    try {
      await resendVerificationEmailMutation.mutateAsync({ email });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  };

  // ── Token present: show verification result ────────────────────────────

  if (token) {
    if (verifyStatus === "verifying" || verifyStatus === "idle") {
      return (
        <main className="verify-email-page">
          <div className="verify-email-page__backdrop" aria-hidden="true" />
          <div className="verify-email-page__card">
            <LoadingState
              className="verify-email-page__loading"
              text="Verificando seu e-mail"
              animation="workspace"
            />
          </div>
        </main>
      );
    }

    if (verifyStatus === "success") {
      return (
        <main className="verify-email-page">
          <div className="verify-email-page__backdrop" aria-hidden="true" />
          <div className="verify-email-page__card">
            <div className="verify-email-page__success-icon" aria-hidden="true" />
            <h1 className="verify-email-page__title">E-mail confirmado!</h1>
            <p className="verify-email-page__text">
              Seu endereço de e-mail foi verificado com sucesso. Voce ja pode fazer login.
            </p>
            <Button
              variant="primary"
              className="verify-email-page__cta"
              onClick={() =>
                navigate(
                  returnTo
                    ? `${routePaths.login}?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(email)}`
                    : routePaths.login
                )
              }
            >
              Ir para o login
            </Button>
          </div>
        </main>
      );
    }

    // error
    return (
      <main className="verify-email-page">
        <div className="verify-email-page__backdrop" aria-hidden="true" />
        <div className="verify-email-page__card">
          <h1 className="verify-email-page__title">Link invalido</h1>
          <p className="verify-email-page__text">{verifyError}</p>

          {email ? (
            <div className="verify-email-page__resend-wrap">
              {resendStatus === "sent" ? (
                <p className="verify-email-page__resend-success">
                  Novo link enviado! Verifique sua caixa de entrada.
                </p>
              ) : (
                <Button
                  variant="primary"
                  className="verify-email-page__cta"
                  onClick={() => void handleResend()}
                  disabled={resendStatus === "loading"}
                >
                  {resendStatus === "loading" ? "Enviando..." : "Reenviar link de verificacao"}
                </Button>
              )}
            </div>
          ) : null}

          <p className="verify-email-page__switch-cta">
            <button
              type="button"
              className="verify-email-page__switch-cta-button"
              onClick={() => navigate(routePaths.login)}
            >
              Voltar para o login
            </button>
          </p>
        </div>
      </main>
    );
  }

  // ── No token: "check your inbox" state ────────────────────────────────

  return (
    <main className="verify-email-page">
      <div className="verify-email-page__backdrop" aria-hidden="true" />
      <div className="verify-email-page__card">
        <div className="verify-email-page__envelope-icon" aria-hidden="true" />
        <h1 className="verify-email-page__title">Confirme seu e-mail</h1>
        <p className="verify-email-page__text">
          Enviamos um link de confirmacao para{" "}
          {email ? <strong>{email}</strong> : "seu e-mail"}. Clique no link para ativar sua conta.
        </p>
        <p className="verify-email-page__hint">
          Nao recebeu? Verifique a pasta de spam ou solicite um novo link.
        </p>

        {email ? (
          <div className="verify-email-page__resend-wrap">
            {resendStatus === "sent" ? (
              <p className="verify-email-page__resend-success">
                Novo link enviado! Verifique sua caixa de entrada.
              </p>
            ) : (
              <Button
                variant="primary"
                className="verify-email-page__cta"
                onClick={() => void handleResend()}
                disabled={resendStatus === "loading"}
              >
                {resendStatus === "loading" ? "Enviando..." : "Reenviar link"}
              </Button>
            )}
            {resendStatus === "error" ? (
              <p className="verify-email-page__resend-error">
                Nao foi possivel reenviar. Tente novamente em instantes.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="verify-email-page__switch-cta">
          <button
            type="button"
            className="verify-email-page__switch-cta-button"
            onClick={() => navigate(routePaths.login)}
          >
            Voltar para o login
          </button>
        </p>
      </div>
    </main>
  );
}
