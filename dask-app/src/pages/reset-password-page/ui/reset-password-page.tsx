import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, TextInput } from "@/shared/ui";
import { authService } from "@/features/auth/api/auth-service";
import { isApiError } from "@/shared/api/http-client";
import { cn } from "@/shared/lib/cn";
import { routePaths } from "@/app/router/route-paths";
import "./reset-password-page.css";

type ResetStatus = "idle" | "loading" | "success" | "error";

function mapConfirmError(error: unknown): string {
  if (!isApiError(error)) {
    return "Nao foi possivel redefinir a senha. Tente novamente.";
  }
  if (error.status === 400) {
    return "Este link de redefinicao e invalido ou ja foi utilizado. Solicite um novo link.";
  }
  if (error.status === 422) {
    return error.message || "A senha nao atende aos requisitos de seguranca.";
  }
  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (error.isNetworkError) {
    return "Nao foi possivel conectar ao servidor. Verifique sua conexao.";
  }
  return "Nao foi possivel redefinir a senha. Tente novamente.";
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<ResetStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoading = status === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 15) {
      setErrorMessage("A senha precisa ter no minimo 15 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("As senhas nao coincidem.");
      return;
    }

    setStatus("loading");

    try {
      await authService.confirmPasswordReset({ token, newPassword });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(mapConfirmError(error));
    }
  };

  if (!token) {
    return (
      <main className="reset-password-page">
        <div className="reset-password-page__backdrop" aria-hidden="true" />
        <div className="reset-password-page__card">
          <h1 className="reset-password-page__title">Link invalido</h1>
          <p className="reset-password-page__text">
            Este link de redefinicao de senha e invalido ou esta incompleto.
            Solicite um novo link na tela de login.
          </p>
          <Button
            variant="primary"
            className="reset-password-page__cta"
            onClick={() => navigate(routePaths.login)}
          >
            Ir para o login
          </Button>
        </div>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="reset-password-page">
        <div className="reset-password-page__backdrop" aria-hidden="true" />
        <div className="reset-password-page__card">
          <div className="reset-password-page__success-icon" aria-hidden="true" />
          <h1 className="reset-password-page__title">Senha redefinida!</h1>
          <p className="reset-password-page__text">
            Sua senha foi alterada com sucesso. Voce ja pode entrar com sua nova senha.
            Por seguranca, todas as sessoes anteriores foram encerradas.
          </p>
          <Button
            variant="primary"
            className="reset-password-page__cta"
            onClick={() => navigate(routePaths.login)}
          >
            Ir para o login
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="reset-password-page">
      <div className="reset-password-page__backdrop" aria-hidden="true" />
      <div className="reset-password-page__card">
        <div className="reset-password-page__header">
          <h1 className="reset-password-page__title">Nova senha</h1>
          <p className="reset-password-page__subtitle">
            Escolha uma senha forte com no minimo 15 caracteres.
          </p>
        </div>

        <form
          className="reset-password-page__form"
          onSubmit={event => void handleSubmit(event)}
          noValidate
        >
          <div className="reset-password-page__field">
            <label className="reset-password-page__label" htmlFor="new-password">
              Nova senha
            </label>
            <div className="reset-password-page__password-wrap">
              <TextInput
                className="reset-password-page__input reset-password-page__input--password"
                id="new-password"
                name="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                placeholder="Minimo 15 caracteres"
                required
              />
              <button
                type="button"
                className={cn(
                  "reset-password-page__toggle",
                  showPassword && "reset-password-page__toggle--active"
                )}
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-controls="new-password"
                aria-pressed={showPassword}
              >
                <span className="reset-password-page__toggle-eye" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="reset-password-page__field">
            <label className="reset-password-page__label" htmlFor="confirm-password">
              Confirmar senha
            </label>
            <TextInput
              className="reset-password-page__input"
              id="confirm-password"
              name="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              placeholder="Repita a nova senha"
              required
            />
          </div>

          {errorMessage ? (
            <p className="reset-password-page__message" role="alert" aria-live="polite">
              {errorMessage}
            </p>
          ) : null}

          <Button
            className="reset-password-page__submit"
            type="submit"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>

        <p className="reset-password-page__switch-cta">
          Lembrou a senha?{" "}
          <button
            type="button"
            className="reset-password-page__switch-cta-button"
            onClick={() => navigate(routePaths.login)}
          >
            Voltar para o login
          </button>
        </p>
      </div>
    </main>
  );
}
