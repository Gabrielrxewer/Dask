import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { routePaths } from "@/app/router";
import { authService } from "@/features/auth/api/auth-service";
import { isApiError } from "@/shared/api/http-client";
import { Button } from "@/shared/ui";
import "./verify-email-page.css";

function getVerifyEmailError(error: unknown): string {
  if (!isApiError(error)) {
    return "Nao foi possivel validar o e-mail.";
  }

  if (error.status === 400) {
    return "O link de verificacao e invalido ou expirou.";
  }

  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  return error.message || "Nao foi possivel validar o e-mail.";
}

function getResendError(error: unknown): string {
  if (!isApiError(error)) {
    return "Nao foi possivel reenviar o e-mail de verificacao.";
  }

  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos antes de reenviar.";
  }

  return error.message || "Nao foi possivel reenviar o e-mail de verificacao.";
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const email = searchParams.get("email")?.trim() ?? "";

  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">(
    token ? "verifying" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    setStatus("verifying");
    setMessage(null);

    void authService
      .verifyEmail(token)
      .then(() => {
        if (!active) {
          return;
        }
        setStatus("verified");
        setMessage("E-mail validado com sucesso. Voce ja pode entrar na plataforma.");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setStatus("error");
        setMessage(getVerifyEmailError(error));
      });

    return () => {
      active = false;
    };
  }, [token]);

  const helperText = useMemo(() => {
    if (token) {
      return "Estamos validando seu e-mail para liberar o acesso.";
    }

    if (email) {
      return `Enviamos a verificacao para ${email}. Confirme seu e-mail para concluir o acesso.`;
    }

    return "Use o link recebido por e-mail para validar sua conta ou solicite um novo envio.";
  }, [email, token]);

  const handleResend = async () => {
    if (!email) {
      setResendStatus("error");
      setResendMessage("Informe um e-mail valido pelo fluxo de cadastro ou login.");
      return;
    }

    setResendStatus("submitting");
    setResendMessage(null);

    try {
      await authService.resendVerificationEmail({ email });
      setResendStatus("success");
      setResendMessage("Novo e-mail de verificacao enviado.");
    } catch (error) {
      setResendStatus("error");
      setResendMessage(getResendError(error));
    }
  };

  return (
    <main className="verify-email-page">
      <section className="verify-email-page__panel" aria-label="Verificacao de e-mail">
        <div className="verify-email-page__header">
          <p className="verify-email-page__eyebrow">Verificacao de conta</p>
          <h1 className="verify-email-page__title">Confirme seu e-mail</h1>
          <p className="verify-email-page__subtitle">{helperText}</p>
        </div>

        {message ? (
          <p
            className={`verify-email-page__message verify-email-page__message--${status === "verified" ? "success" : status === "verifying" ? "info" : "default"}`}
            role={status === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}

        {!token ? (
          <div className="verify-email-page__actions">
            <Button type="button" variant="primary" onClick={() => void handleResend()} disabled={!email || resendStatus === "submitting"}>
              {resendStatus === "submitting" ? "Reenviando..." : "Reenviar verificacao"}
            </Button>
            <Link className="verify-email-page__link" to={routePaths.login}>
              Voltar para o login
            </Link>
          </div>
        ) : (
          <div className="verify-email-page__actions">
            <Link className="verify-email-page__link verify-email-page__link--primary" to={routePaths.login}>
              Ir para login
            </Link>
          </div>
        )}

        {resendMessage ? (
          <p
            className={`verify-email-page__message verify-email-page__message--${resendStatus === "success" ? "success" : "default"}`}
            role={resendStatus === "error" ? "alert" : "status"}
          >
            {resendMessage}
          </p>
        ) : null}
      </section>
    </main>
  );
}
