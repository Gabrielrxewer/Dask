import { useState } from "react";
import { useAuth } from "@/features/auth/model";

interface UseLogoutResult {
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  isSubmitting: boolean;
}

export function useLogout(): UseLogoutResult {
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = async (callback: () => Promise<void>): Promise<void> => {
    setIsSubmitting(true);
    try {
      await callback();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    logout: () => run(auth.logout),
    logoutAll: () => run(auth.logoutAll),
    isSubmitting
  };
}
