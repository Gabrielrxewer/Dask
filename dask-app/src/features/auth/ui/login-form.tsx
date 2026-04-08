import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Button, TextInput } from "@/shared/ui";
import { useAuth, useLogin } from "@/features/auth";
import "./login-form.css";

interface LoginLocationState {
  reason?: "session_expired" | "unauthenticated";
}

export function LoginForm() {
  const auth = useAuth();
  const location = useLocation();
  const { login, isSubmitting } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const locationState = (location.state as LoginLocationState | null) ?? null;

  const hintMessage = useMemo(() => {
    if (auth.errorMessage) {
      return auth.errorMessage;
    }

    if (locationState?.reason === "session_expired" || auth.status === "session_expired") {
      return auth.sessionNotice ?? "Sua sessao expirou. Faca login novamente.";
    }

    return auth.sessionNotice;
  }, [auth.errorMessage, auth.sessionNotice, auth.status, locationState?.reason]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login({
      email: email.trim(),
      password
    });
  };

  return (
    <section className="auth-login">
      <div className="auth-login__header">
        <p className="auth-login__eyebrow">Dask</p>
        <h1 className="auth-login__title">Entrar na plataforma</h1>
        <p className="auth-login__subtitle">Use sua conta para acessar o workspace com seguranca.</p>
      </div>

      <form className="auth-login__form" onSubmit={event => void handleSubmit(event)} noValidate>
        <label className="auth-login__label" htmlFor="email">
          Email
        </label>
        <TextInput
          className="auth-login__input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="voce@empresa.com"
          required
        />

        <div className="auth-login__password-field">
          <label className="auth-login__label" htmlFor="password">
            Senha
          </label>
          <div className="auth-login__password-input-wrap">
            <TextInput
              className="auth-login__input auth-login__input--password"
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
            />
            <button
              type="button"
              className={`auth-login__toggle ${showPassword ? "auth-login__toggle--active" : ""}`.trim()}
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-controls="password"
              aria-pressed={showPassword}
            >
              <span className="auth-login__toggle-eye" aria-hidden="true" />
            </button>
          </div>
        </div>

        {hintMessage ? (
          <p className="auth-login__message" role="alert" aria-live="polite">
            {hintMessage}
          </p>
        ) : null}

        <Button className="auth-login__submit" type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </section>
  );
}
