import { useMutation } from "@tanstack/react-query";
import { authService } from "@/features/auth/api/auth-service";
import type {
  ConfirmPasswordResetInput,
  RequestPasswordResetInput,
  ResendVerificationEmailInput,
  RequestPasswordResetResponse
} from "@/features/auth/api/types";

const verificationRequests = new Map<string, Promise<void>>();

export function verifyEmailOnce(token: string): Promise<void> {
  const existingRequest = verificationRequests.get(token);
  if (existingRequest) {
    return existingRequest;
  }

  const request = authService.verifyEmail(token).catch((error) => {
    verificationRequests.delete(token);
    throw error;
  });
  verificationRequests.set(token, request);
  return request;
}

export function useRequestPasswordResetMutation() {
  return useMutation<RequestPasswordResetResponse, Error, RequestPasswordResetInput>({
    mutationFn: (input) => authService.requestPasswordReset(input)
  });
}

export function useResendVerificationEmailMutation() {
  return useMutation<void, Error, ResendVerificationEmailInput>({
    mutationFn: (input) => authService.resendVerificationEmail(input)
  });
}

export function useConfirmPasswordResetMutation() {
  return useMutation<void, Error, ConfirmPasswordResetInput>({
    mutationFn: (input) => authService.confirmPasswordReset(input)
  });
}
