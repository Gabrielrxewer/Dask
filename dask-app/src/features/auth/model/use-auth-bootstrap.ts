import { useEffect } from "react";
import type { AuthStore } from "@/features/auth/model/auth-store";

export function useAuthBootstrap(store: AuthStore): void {
  useEffect(() => {
    void store.bootstrap();
  }, [store]);
}
