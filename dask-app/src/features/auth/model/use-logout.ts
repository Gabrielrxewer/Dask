import { useAuth } from "@/features/auth/model";
import { useAsyncAction } from "@/shared/lib/react/use-async-action";

interface UseLogoutResult {
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  isSubmitting: boolean;
}

export function useLogout(): UseLogoutResult {
  const auth = useAuth();
  const logoutAction = useAsyncAction(auth.logout);
  const logoutAllAction = useAsyncAction(auth.logoutAll);

  return {
    logout: logoutAction.run,
    logoutAll: logoutAllAction.run,
    isSubmitting: logoutAction.isSubmitting || logoutAllAction.isSubmitting
  };
}
