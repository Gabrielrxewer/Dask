export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string | null;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export type MembersById = Record<MemberId, Member>;
