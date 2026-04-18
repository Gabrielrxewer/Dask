import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, TextInput } from "@/shared/ui";
import { useAuth, useLogin } from "@/features/auth";
import { authService } from "@/features/auth/api/auth-service";
import { cn } from "@/shared/lib/cn";
import { buildApiUrl } from "@/shared/config/env";
import { isApiError } from "@/shared/api/http-client";
import { routePaths } from "@/app/router/route-paths";
import { workspaceService } from "@/modules/workspace/api";
import type { PublicWorkspaceInvite } from "@/modules/workspace/model";
import "./login-form.css";

interface LoginLocationState {
  reason?: "session_expired" | "unauthenticated";
}

type SocialProvider = {
  id: "google" | "microsoft";
  label: string;
  shortLabel: string;
};

type AuthStep = "login" | "register" | "forgot-password";

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

const EMAIL_NOT_VERIFIED_CODE = "EMAIL_NOT_VERIFIED";
const TERMS_VERSION = "2026-04-18";
const PRIVACY_VERSION = "2026-04-18";

type OAuthErrorCode =
  | "cancelled"
  | "session_expired"
  | "invalid_request"
  | "provider_auth_failed"
  | "provider_unavailable"
  | "provider_rejected"
  | "unexpected";

function hasErrorCode(details: unknown, code: string): boolean {
  if (!details || typeof details !== "object") {
    return false;
  }

  return (details as { code?: unknown }).code === code;
}

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

function mapOAuthErrorMessage(provider: string | null, errorCode: string | null): string {
  const providerLabel = provider === "microsoft" ? "Microsoft" : provider === "google" ? "Google" : "o provedor externo";
  const normalizedCode = (errorCode ?? "unexpected") as OAuthErrorCode;

  switch (normalizedCode) {
    case "cancelled":
      return `Login com ${providerLabel} cancelado. Se quiser, tente novamente.`;
    case "session_expired":
      return `Sua tentativa de login com ${providerLabel} expirou. Clique novamente em ${providerLabel} para iniciar de novo.`;
    case "invalid_request":
      return `Nao foi possivel concluir o login com ${providerLabel}. Tente novamente em instantes.`;
    case "provider_auth_failed":
      return `Nao conseguimos validar sua autenticacao com ${providerLabel}. Tente novamente.`;
    case "provider_unavailable":
      return `${providerLabel} esta indisponivel no momento. Tente de novo em alguns minutos.`;
    case "provider_rejected":
      return `${providerLabel} recusou a autenticacao. Revise suas permissoes e tente novamente.`;
    default:
      return `Ocorreu uma falha ao entrar com ${providerLabel}. Tente novamente ou entre com e-mail e senha.`;
  }
}

export function LoginForm() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isSubmitting } = useLogin();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [acceptedNonEssentialCookies, setAcceptedNonEssentialCookies] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>(() =>
    new URLSearchParams(location.search).get("step") === "register" ? "register" : "login"
  );
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<PublicWorkspaceInvite | null>(null);
  const [inviteInfoError, setInviteInfoError] = useState<string | null>(null);

  const locationState = (location.state as LoginLocationState | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const oauthLinkRequired = searchParams.get("oauth") === "link_required";
  const oauthError = searchParams.get("oauth") === "error";
  const oauthProvider = searchParams.get("provider");
  const oauthErrorCode = searchParams.get("error");
  const inviteToken = searchParams.get("invite") ?? undefined;
  const invitedEmail = searchParams.get("email");
  const isRegisterStep = authStep === "register";
  const isForgotStep = authStep === "forgot-password";

  useEffect(() => {
    if (!inviteToken) {
      setInviteInfo(null);
      setInviteInfoError(null);
      return;
    }

    let mounted = true;
    workspaceService
      .getWorkspaceInviteByToken(inviteToken)
      .then((data) => {
        if (!mounted) {
          return;
        }
        setInviteInfo(data);
        setInviteInfoError(null);
        if (!email && data.email) {
          setEmail(data.email);
        }
      })
      .catch(() => {
        if (mounted) {
          setInviteInfo(null);
          setInviteInfoError("Este convite nao e mais valido. Voce ainda pode entrar normalmente.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [inviteToken]);

  useEffect(() => {
    if (!inviteToken || !invitedEmail) {
      return;
    }
    if (!email) {
      setEmail(invitedEmail);
    }
  }, [inviteToken, invitedEmail, email]);

  const hintMessage = useMemo(() => {
    if (registerError) {
      return registerError;
    }

    if (inviteInfoError) {
      return inviteInfoError;
    }

    if (inviteInfo && inviteInfo.status === "PENDING") {
      return `Convite para ${inviteInfo.workspace.name} (${inviteInfo.role}). Entre ou crie conta com ${inviteInfo.email} para aceitar automaticamente.`;
    }

    if (isRegisterStep) {
      return null;
    }

    if (oauthError) {
      return mapOAuthErrorMessage(oauthProvider, oauthErrorCode);
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
    oauthError,
    oauthErrorCode,
    oauthLinkRequired,
    oauthProvider,
    registerError,
    inviteInfoError,
    inviteInfo
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

      if (!acceptedTerms || !acceptedPrivacy) {
        setRegisterError("Voce precisa aceitar os Termos de Uso e a Politica de Privacidade.");
        return;
      }

      try {
        await auth.register({
          email: email.trim(),
          name: trimmedName,
          password,
          legalAcceptance: {
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            acceptedTerms: true,
            acceptedPrivacy: true,
            acceptedMarketing,
            acceptedNonEssentialCookies
          },
          inviteToken
        });
        navigate(`${routePaths.verifyEmail}?email=${encodeURIComponent(email.trim())}`);
      } catch (error) {
        setRegisterError(mapRegisterError(error));
      }

      return;
    }

    try {
      await login({
        email: email.trim(),
        password,
        inviteToken
      });
    } catch (error) {
      if (
        isApiError(error) &&
        error.status === 403 &&
        hasErrorCode(error.details, EMAIL_NOT_VERIFIED_CODE)
      ) {
        navigate(`${routePaths.verifyEmail}?email=${encodeURIComponent(email.trim())}`);
      }
    }
  };

  const handleSocialLogin = (providerId: SocialProvider["id"]) => {
    const redirectOrigin = encodeURIComponent(window.location.origin);
    const inviteQuery = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : "";
    window.location.assign(buildApiUrl(`/auth/${providerId}?redirect_origin=${redirectOrigin}${inviteQuery}`));
  };

  const handleStepChange = (step: AuthStep) => {
    setAuthStep(step);
    setRegisterError(null);
    setForgotStatus("idle");
    setForgotError(null);
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setForgotError("Informe seu e-mail para continuar.");
      return;
    }
    setForgotStatus("loading");
    setForgotError(null);
    try {
      await authService.requestPasswordReset({ email: trimmedEmail });
      setForgotStatus("sent");
    } catch {
      setForgotStatus("error");
      setForgotError("Nao foi possivel enviar o link. Tente novamente em instantes.");
    }
  };

  if (isForgotStep) {
    return (
      <section className="auth-login-panel" aria-label="Recuperar senha">
        <div className="auth-login">
          <div className="auth-login__header">
            <h1 className="auth-login__title">Recuperar senha</h1>
            <p className="auth-login__subtitle">
              Informe seu e-mail e enviaremos um link para voce criar uma nova senha.
            </p>
          </div>

          {forgotStatus === "sent" ? (
            <div className="auth-login__form">
              <p className="auth-login__message auth-login__message--success" role="status">
                Link enviado! Verifique sua caixa de entrada e a pasta de spam. O link expira em 1 hora.
              </p>
              <p className="auth-login__switch-cta">
                <button
                  type="button"
                  className="auth-login__switch-cta-button"
                  onClick={() => handleStepChange("login")}
                >
                  Voltar para o login
                </button>
              </p>
            </div>
          ) : (
            <form className="auth-login__form" onSubmit={event => void handleForgotSubmit(event)} noValidate>
              <div className="auth-login__field">
                <label className="auth-login__label" htmlFor="forgot-email">
                  Email
                </label>
                <TextInput
                  className="auth-login__input"
                  id="forgot-email"
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

              {forgotError ? (
                <p className="auth-login__message" role="alert" aria-live="polite">
                  {forgotError}
                </p>
              ) : null}

              <Button
                className="auth-login__submit"
                type="submit"
                variant="primary"
                disabled={forgotStatus === "loading"}
              >
                {forgotStatus === "loading" ? "Enviando..." : "Enviar link de recuperacao"}
              </Button>

              <p className="auth-login__switch-cta">
                Lembrou a senha?{" "}
                <button
                  type="button"
                  className="auth-login__switch-cta-button"
                  onClick={() => handleStepChange("login")}
                >
                  Voltar para o login
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "auth-login-panel",
        isRegisterStep && hintMessage && "auth-login-panel--register-message"
      )}
      aria-label="Acesso ao Dask"
    >
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
            {!isRegisterStep ? (
              <p className="auth-login__forgot-row">
                <button
                  type="button"
                  className="auth-login__forgot-link"
                  onClick={() => handleStepChange("forgot-password")}
                >
                  Esqueci minha senha
                </button>
              </p>
            ) : null}
          </div>

          {isRegisterStep ? (
            <div className="auth-login__consent-list" aria-label="Consentimentos obrigatorios">
              <label className="auth-login__consent-item">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={event => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  Li e aceito os <Link to={routePaths.termsOfUse}>Termos de Uso</Link>.
                </span>
              </label>
              <label className="auth-login__consent-item">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={event => setAcceptedPrivacy(event.target.checked)}
                />
                <span>
                  Li e estou ciente da <Link to={routePaths.privacyPolicy}>Politica de Privacidade</Link>.
                </span>
              </label>
              <label className="auth-login__consent-item auth-login__consent-item--optional">
                <input
                  type="checkbox"
                  checked={acceptedMarketing}
                  onChange={event => setAcceptedMarketing(event.target.checked)}
                />
                <span>Quero receber comunicacoes de marketing por e-mail (opcional).</span>
              </label>
              <label className="auth-login__consent-item auth-login__consent-item--optional">
                <input
                  type="checkbox"
                  checked={acceptedNonEssentialCookies}
                  onChange={event => setAcceptedNonEssentialCookies(event.target.checked)}
                />
                <span>Aceito cookies nao essenciais para melhoria de experiencia (opcional).</span>
              </label>
            </div>
          ) : null}

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

          <p className="auth-login__legal">
            Ao continuar, voce concorda com os <Link to={routePaths.termsOfUse}>Termos de Uso</Link> e com a{" "}
            <Link to={routePaths.privacyPolicy}>Politica de Privacidade</Link>.
          </p>
        </form>
      </div>
    </section>
  );
}
