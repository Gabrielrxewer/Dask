export type MemberId = "u1" | "u2" | "u3" | "u4";

export interface Member {
  id: MemberId;
  name: string;
  initials: string;
  color: string;
}

export type MembersById = Record<MemberId, Member>;
