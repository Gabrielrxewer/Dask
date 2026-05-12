import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/http-client";
import {
  getPublicDecisionErrorMessage,
  getPublicDocumentLoadMessage,
  normalizePublicDocumentErrorState
} from "@/pages/proposal-public-page/ui/proposal-public-page";

describe("ProposalPublicPage public access messages", () => {
  it("maps expired links and permission errors to clear states", () => {
    expect(normalizePublicDocumentErrorState(new ApiError({
      status: 410,
      message: "Expired",
      details: { code: "TOKEN_EXPIRED" }
    }))).toBe("expired");
    expect(normalizePublicDocumentErrorState(new ApiError({
      status: 401,
      message: "Authentication required.",
      details: { code: "DOCUMENT_AUTH_REQUIRED" }
    }))).toBe("auth_required");
    expect(normalizePublicDocumentErrorState(new ApiError({
      status: 403,
      message: "Forbidden",
      details: { code: "RECIPIENT_EMAIL_MISMATCH" }
    }))).toBe("forbidden");
  });

  it("keeps user-facing copy explicit for login, expiration and permission states", () => {
    expect(getPublicDocumentLoadMessage("expired").body).toContain("novo envio");
    expect(getPublicDocumentLoadMessage("auth_required").body).toContain("sessao valida");
    expect(getPublicDocumentLoadMessage("forbidden").body).toContain("e-mail destinatario");
  });

  it("maps public decision failures without exposing token details", () => {
    expect(getPublicDecisionErrorMessage(new ApiError({
      status: 403,
      message: "Forbidden",
      details: { code: "RECIPIENT_EMAIL_MISMATCH" }
    }))).toContain("e-mail destinatario");
    expect(getPublicDecisionErrorMessage(new ApiError({
      status: 403,
      message: "Forbidden",
      details: { code: "DOCUMENT_DECISION_DISABLED" }
    }))).toContain("desativados");
    expect(getPublicDecisionErrorMessage(new ApiError({
      status: 410,
      message: "Expired",
      details: { code: "TOKEN_EXPIRED" }
    }))).toContain("expirou");
  });
});
