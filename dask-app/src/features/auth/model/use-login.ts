import { useState } from "react";
import { useAuth } from "@/features/auth/model/auth-provider";
import type { LoginInput } from "@/features/auth/api/types";

interface UseLoginResult {
  login: (input: LoginInput) => Promise<void>;
  isSubmitting: boolean;
}

export function useLogin(): UseLoginResult {
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const login = async (input: LoginInput): Promise<void> => {
    setIsSubmitting(true);
    try {
      await auth.login(input);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    login,
    isSubmitting
  };
}
