import type { ReactNode } from "react";
import { AuthProvider as FeatureAuthProvider } from "@/features/auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <FeatureAuthProvider>{children}</FeatureAuthProvider>;
}
