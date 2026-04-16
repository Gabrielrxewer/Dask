import { useEffect, useState } from "react";
import type { Member } from "@/entities/member/model/types";
import "./member-avatar.css";

interface MemberAvatarProps {
  member?: Member | null;
}

export function MemberAvatar({ member }: MemberAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [member?.avatarUrl]);

  if (!member) return null;
  const avatarUrl = member.avatarUrl && !hasImageError ? member.avatarUrl : null;

  return (
    <span
      className="member-avatar"
      style={{ background: avatarUrl ? undefined : member.color }}
      title={member.name}
      aria-label={member.name}
    >
      {avatarUrl ? (
        <img
          className="member-avatar__image"
          src={avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasImageError(true)}
        />
      ) : (
        member.initials
      )}
    </span>
  );
}
