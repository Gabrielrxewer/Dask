import type { Member } from "@/entities/member/model/types";
import "./member-avatar.css";

interface MemberAvatarProps {
  member?: Member | null;
}

export function MemberAvatar({ member }: MemberAvatarProps) {
  if (!member) return null;

  return (
    <span
      className="member-avatar"
      style={{ background: member.color }}
      title={member.name}
      aria-label={member.name}
    >
      {member.initials}
    </span>
  );
}
