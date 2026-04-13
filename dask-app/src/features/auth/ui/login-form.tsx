import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { Button, TextInput } from "@/shared/ui";
import { useAuth, useLogin } from "@/features/auth";
import { cn } from "@/shared/lib/cn";
import { buildApiUrl } from "@/shared/config/env";
import { isApiError } from "@/shared/api/http-client";
import "./login-form.css";

interface LoginLocationState {
  reason?: "session_expired" | "unauthenticated";
}

type SocialProvider = {
  id: "google" | "microsoft";
  label: string;
  shortLabel: string;
};

type AuthStep = "login" | "register";

const socialProviders: SocialProvider[] = [
  {
    id: "google",
    label: "Entrar com Google",
    shortLabel: "Google"
  },
  {
    id: "microsoft",
    label: "Entrar com Microsoft",
    shortLabel: "Microsoft"
  }
];

function mapRegisterError(error: unknown): string {
  if (!isApiError(error)) {
    return "Falha ao criar conta. Tente novamente.";
  }

  if (error.status === 409) {
    return "Ja existe uma conta com este email. Entre com sua senha.";
  }

  if (error.status === 400) {
    return "Confira os dados informados e tente novamente.";
  }

  if (error.status === 429) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  if (error.isNetworkError) {
    return "Nao foi possivel conectar ao servidor.";
  }

  return error.message || "Falha ao criar conta. Tente novamente.";
}

export function LoginForm() {
  const auth = useAuth();
  const location = useLocation();
  const { login, isSubmitting } = useLogin();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>(() =>
    new URLSearchParams(location.search).get("step") === "register" ? "register" : "login"
  );
  const [registerError, setRegisterError] = useState<string | null>(null);

  const locationState = (location.state as LoginLocationState | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const oauthLinkRequired = searchParams.get("oauth") === "link_required";
  const oauthProvider = searchParams.get("provider");
  const isRegisterStep = authStep === "register";

  const hintMessage = useMemo(() => {
    if (registerError) {
      return registerError;
    }

    if (isRegisterStep) {
      return null;
    }

    if (auth.errorMessage) {
      return auth.errorMessage;
    }

    if (oauthLinkRequired) {
      const providerLabel = oauthProvider === "microsoft" ? "Microsoft" : "Google";
      return `Ja existe uma conta com este email. Entre com senha para vincular ${providerLabel}.`;
    }

    if (locationState?.reason === "session_expired" || auth.status === "session_expired") {
      return auth.sessionNotice ?? "Sua sessao expirou. Faca login novamente.";
    }

    return auth.sessionNotice;
  }, [
    auth.errorMessage,
    auth.sessionNotice,
    auth.status,
    isRegisterStep,
    locationState?.reason,
    oauthLinkRequired,
    oauthProvider,
    registerError
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterError(null);

    if (isRegisterStep) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        setRegisterError("Informe seu nome para criar a conta.");
        return;
      }

      if (password.trim().length < 8) {
        setRegisterError("A senha precisa ter no minimo 8 caracteres.");
        return;
      }

      try {
        await auth.register({
          email: email.trim(),
          name: trimmedName,
          password
        });
      } catch (error) {
        setRegisterError(mapRegisterError(error));
      }

      return;
    }

    await login({
      email: email.trim(),
      password
    });
  };

  const handleSocialLogin = (providerId: SocialProvider["id"]) => {
    window.location.assign(buildApiUrl(`/auth/${providerId}`));
  };

  const handleStepChange = (step: AuthStep) => {
    setAuthStep(step);
    setRegisterError(null);
  };

  return (
    <section className="auth-login-panel" aria-label="Acesso ao Dask">
      <div className="auth-login">
        <div className="auth-login__header">
          <h1 className="auth-login__title">{isRegisterStep ? "Crie sua conta" : "Entrar na plataforma"}</h1>
          <p className="auth-login__subtitle">
            {isRegisterStep
              ? "Novo por aqui? Registre-se para acessar seu workspace com seguranca."
              : "Use sua conta para acessar o workspace com seguranca e continuidade."}
          </p>
        </div>

        <form className="auth-login__form" onSubmit={event => void handleSubmit(event)} noValidate>
          {isRegisterStep ? (
            <div className="auth-login__field">
              <label className="auth-login__label" htmlFor="name">
                Nome
              </label>
              <TextInput
                className="auth-login__input"
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>
          ) : null}

          <div className="auth-login__field">
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
          </div>

          <div className="auth-login__field auth-login__password-field">
            <label className="auth-login__label" htmlFor="password">
              Senha
            </label>
            <div className="auth-login__password-input-wrap">
              <TextInput
                className="auth-login__input auth-login__input--password"
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegisterStep ? "new-password" : "current-password"}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Sua senha"
                required
              />
              <button
                type="button"
                className={cn("auth-login__toggle", showPassword && "auth-login__toggle--active")}
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
            {isSubmitting ? (isRegisterStep ? "Criando conta..." : "Entrando...") : isRegisterStep ? "Criar conta" : "Entrar"}
          </Button>

          <div className="auth-login__social" aria-label="Acessos sociais">
            {socialProviders.map(provider => (
              <button
                key={provider.id}
                type="button"
                className="auth-login__social-button"
                onClick={() => handleSocialLogin(provider.id)}
                title={provider.label}
                aria-label={provider.label}
              >
                <span className={cn("auth-login__social-icon", `auth-login__social-icon--${provider.id}`)} aria-hidden="true">
                  {provider.id === "google" ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path
                        d="M21.77 12.25c0-.77-.07-1.5-.2-2.21H12.2v4.18h5.36a4.59 4.59 0 0 1-1.98 3.02v2.5h3.2c1.87-1.72 2.99-4.25 2.99-7.49Z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12.2 22c2.69 0 4.95-.89 6.6-2.42l-3.2-2.5c-.89.6-2.03.96-3.4.96-2.61 0-4.82-1.76-5.62-4.12H3.27v2.57A9.97 9.97 0 0 0 12.2 22Z"
                        fill="#34A853"
                      />
                      <path
                        d="M6.58 13.92a5.98 5.98 0 0 1 0-3.84V7.5H3.27a9.97 9.97 0 0 0 0 8.99l3.31-2.57Z"
                        fill="#FBBC04"
                      />
                      <path
                        d="M12.2 6.04c1.46 0 2.78.5 3.82 1.48l2.86-2.86C17.14 3.06 14.89 2 12.2 2a9.97 9.97 0 0 0-8.93 5.5l3.31 2.58c.8-2.37 3.01-4.04 5.62-4.04Z"
                        fill="#EA4335"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M3 3h8.5v8.5H3z" fill="#F1511B" />
                      <path d="M12.5 3H21v8.5h-8.5z" fill="#80CC28" />
                      <path d="M3 12.5h8.5V21H3z" fill="#00ADEF" />
                      <path d="M12.5 12.5H21V21h-8.5z" fill="#FBBC09" />
                    </svg>
                  )}
                </span>
                <span className="auth-login__social-label">{provider.shortLabel}</span>
              </button>
            ))}
          </div>

          <p className="auth-login__switch-cta">
            {isRegisterStep ? "Ja possui cadastro?" : "Ainda nao tem conta?"}{" "}
            <button
              type="button"
              className="auth-login__switch-cta-button"
              onClick={() => handleStepChange(isRegisterStep ? "login" : "register")}
            >
              {isRegisterStep ? "Entrar" : "Registre-se"}
            </button>
          </p>
        </form>
      </div>
    </section>
  );
}
