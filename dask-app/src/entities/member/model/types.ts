export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
  initials: string;
  color: string;
}

export type MembersById = Record<MemberId, Member>;
