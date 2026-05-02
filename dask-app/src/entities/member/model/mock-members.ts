import type { MembersById } from "@/entities/member/model/types";

export const currentUserId = "u1";

export const membersById: MembersById = {
  u1: { id: "u1", name: "Gabriel Alves", initials: "GA", color: "var(--text-secondary)" },
  u2: { id: "u2", name: "Maya Costa", initials: "MY", color: "var(--success-border)" },
  u3: { id: "u3", name: "Bruno Neri", initials: "BR", color: "var(--warning-border)" },
  u4: { id: "u4", name: "Lia Torres", initials: "LI", color: "var(--danger-border)" }
};
