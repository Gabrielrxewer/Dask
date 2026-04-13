import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { routePaths } from "@/app/router";
import { authService } from "@/features/auth/api/auth-service";
import { isApiError } from "@/shared/api/http-client";
import { Button, TextInput } from "@/shared/ui";
import "./reset-password-page.css";

function getPasswordResetError(error: unknown): string {
  if (!isApiError(error)) {
    return "Nao foi possivel redefinir a senha.";
  }

  if (error.status === 400) {
    return "O link de redefinicao e invalido ou expirou.";
  }

  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  return error.message || "Nao foi possivel redefinir a senha.";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const isTokenMissing = token.length === 0;

  const helperMessage = useMemo(() => {
    if (isTokenMissing) {
      return "O link de redefinicao esta incompleto. Solicite um novo e-mail para continuar.";
    }

    return "Defina uma nova senha para concluir o acesso a plataforma.";
  }, [isTokenMissing]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isTokenMissing) {
      setStatus("error");
      setMessage("Token ausente.");
      return;
    }

    if (password.trim().length < 8) {
      setStatus("error");
      setMessage("A senha precisa ter no minimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("As senhas informadas nao coincidem.");
      return;
    }

    setStatus("submitting");
    setMessage(null);

    try {
      await authService.confirmPasswordReset({
        token,
        newPassword: password
      });
      setStatus("success");
      setMessage("Senha redefinida com sucesso. Voce ja pode entrar na plataforma.");
      window.setTimeout(() => navigate(routePaths.login), 1200);
    } catch (error) {
      setStatus("error");
      setMessage(getPasswordResetError(error));
    }
  };

  return (
    <main className="reset-password-page">
      <section className="reset-password-page__panel" aria-label="Redefinir senha">
        <div className="reset-password-page__header">
          <p className="reset-password-page__eyebrow">Recuperacao de acesso</p>
          <h1 className="reset-password-page__title">Defina uma nova senha</h1>
          <p className="reset-password-page__subtitle">{helperMessage}</p>
        </div>

        <form className="reset-password-page__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="reset-password-page__field">
            <label htmlFor="new-password">Nova senha</label>
            <TextInput
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo de 8 caracteres"
              disabled={isTokenMissing || status === "submitting" || status === "success"}
            />
          </div>

          <div className="reset-password-page__field">
            <label htmlFor="confirm-password">Confirmar senha</label>
            <TextInput
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a nova senha"
              disabled={isTokenMissing || status === "submitting" || status === "success"}
            />
          </div>

          {message ? (
            <p
              className={`reset-password-page__message reset-password-page__message--${status === "success" ? "success" : "default"}`}
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <div className="reset-password-page__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={isTokenMissing || status === "submitting" || status === "success"}
            >
              {status === "submitting" ? "Redefinindo..." : "Redefinir senha"}
            </Button>

            <Link className="reset-password-page__link" to={routePaths.login}>
              Voltar para o login
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
