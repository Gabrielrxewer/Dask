import { useAuth } from "@/features/auth/model";
import type { LoginInput } from "@/features/auth/api/types";
import { useAsyncAction } from "@/shared/lib/react/use-async-action";

interface UseLoginResult {
  login: (input: LoginInput) => Promise<void>;
  isSubmitting: boolean;
}

export function useLogin(): UseLoginResult {
  const auth = useAuth();
  const { run, isSubmitting } = useAsyncAction(auth.login);

  return {
    login: run,
    isSubmitting
  };
}
