export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  avatarUrl?: string | null;
  avatarSource?: "manual" | "provider" | null;
  manualAvatarUrl?: string | null;
  providerAvatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}
