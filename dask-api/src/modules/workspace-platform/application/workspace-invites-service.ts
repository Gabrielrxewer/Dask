import crypto from 'crypto';
import type { MembershipRole, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import type { EmailService } from '@/infra/email/email-service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function createRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

type InviteProjection = {
  id: string;
  email: string;
  role: MembershipRole;
  expiresAt: Date;
  sentAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  workspace: {
    id: string;
    name: string;
    key: string;
    kind: 'PERSONAL' | 'CORPORATE';
  };
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
};

export type WorkspaceInviteSummary = {
  id: string;
  email: string;
  role: MembershipRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  sentAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type PublicWorkspaceInvite = {
  email: string;
  role: MembershipRole;
  workspace: {
    id: string;
    name: string;
    key: string;
  };
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
};

export class WorkspaceInvitesService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly emailService?: EmailService
  ) {}

  public async listWorkspaceInvites(input: { workspaceId: string }): Promise<WorkspaceInviteSummary[]> {
    const rows = await this.prisma.workspaceInvite.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: this.resolveInviteStatus({
        acceptedAt: row.acceptedAt,
        revokedAt: row.revokedAt,
        expiresAt: row.expiresAt
      }),
      expiresAt: row.expiresAt,
      sentAt: row.sentAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt
    }));
  }

  public async createOrResendInvite(input: {
    workspaceId: string;
    email: string;
    role: MembershipRole;
    invitedByUserId: string;
  }): Promise<WorkspaceInviteSummary> {
    const email = normalizeEmail(input.email);
    const { invite, rawToken } = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true, kind: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found.', 404);
      }

      if (workspace.kind !== 'CORPORATE') {
        throw new AppError('Invites are only available for corporate workspaces.', 422);
      }

      const invitedUser = await tx.user.findUnique({
        where: { email },
        select: { id: true }
      });

      if (invitedUser) {
        const existingMembership = await tx.workspaceMembership.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: input.workspaceId,
              userId: invitedUser.id
            }
          },
          select: { userId: true }
        });

        if (existingMembership) {
          throw new AppError('This user is already a workspace member.', 409);
        }
      }

      const now = new Date();
      const rawToken = createRawToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

      const existingPending = await tx.workspaceInvite.findFirst({
        where: {
          workspaceId: input.workspaceId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now
          }
        }
      });

      const invite = existingPending
        ? await tx.workspaceInvite.update({
            where: { id: existingPending.id },
            data: {
              role: input.role,
              tokenHash,
              sentAt: now,
              expiresAt,
              invitedByUserId: input.invitedByUserId
            },
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  key: true,
                  kind: true
                }
              },
              invitedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          })
        : await tx.workspaceInvite.create({
            data: {
              workspaceId: input.workspaceId,
              email,
              role: input.role,
              tokenHash,
              invitedByUserId: input.invitedByUserId,
              sentAt: now,
              expiresAt
            },
            include: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  key: true,
                  kind: true
                }
              },
              invitedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          });

      return { invite, rawToken };
    });

    await this.sendInviteEmail(invite, rawToken);

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: this.resolveInviteStatus({
        acceptedAt: invite.acceptedAt,
        revokedAt: invite.revokedAt,
        expiresAt: invite.expiresAt
      }),
      expiresAt: invite.expiresAt,
      sentAt: invite.sentAt,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt
    };
  }

  public async resendInvite(input: {
    workspaceId: string;
    inviteId: string;
    requestedByUserId: string;
  }): Promise<WorkspaceInviteSummary> {
    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        id: input.inviteId,
        workspaceId: input.workspaceId
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            key: true,
            kind: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!invite) {
      throw new AppError('Invite not found.', 404);
    }

    if (invite.acceptedAt || invite.revokedAt) {
      throw new AppError('Only pending invites can be resent.', 422);
    }

    const updated = await this.prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash,
        sentAt: now,
        expiresAt,
        invitedByUserId: input.requestedByUserId
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            key: true,
            kind: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    await this.sendInviteEmail(updated, rawToken);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      status: this.resolveInviteStatus({
        acceptedAt: updated.acceptedAt,
        revokedAt: updated.revokedAt,
        expiresAt: updated.expiresAt
      }),
      expiresAt: updated.expiresAt,
      sentAt: updated.sentAt,
      acceptedAt: updated.acceptedAt,
      revokedAt: updated.revokedAt,
      createdAt: updated.createdAt
    };
  }

  public async revokeInvite(input: {
    workspaceId: string;
    inviteId: string;
  }): Promise<void> {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        id: input.inviteId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        acceptedAt: true,
        revokedAt: true
      }
    });

    if (!invite) {
      throw new AppError('Invite not found.', 404);
    }

    if (invite.acceptedAt) {
      throw new AppError('Accepted invites cannot be revoked.', 422);
    }

    if (invite.revokedAt) {
      return;
    }

    await this.prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: {
        revokedAt: new Date()
      }
    });
  }

  public async getInviteByToken(rawToken: string): Promise<PublicWorkspaceInvite | null> {
    const tokenHash = hashToken(rawToken);
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash },
      select: {
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            key: true
          }
        }
      }
    });

    if (!invite) {
      return null;
    }

    return {
      email: invite.email,
      role: invite.role,
      workspace: invite.workspace,
      status: this.resolveInviteStatus({
        acceptedAt: invite.acceptedAt,
        revokedAt: invite.revokedAt,
        expiresAt: invite.expiresAt
      }),
      expiresAt: invite.expiresAt
    };
  }

  public async tryAcceptInviteByToken(input: {
    rawToken: string;
    userId: string;
    userEmail: string;
  }): Promise<{ accepted: boolean; reason?: string; workspaceId?: string }> {
    const tokenHash = hashToken(input.rawToken);
    const userEmail = normalizeEmail(input.userEmail);
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        role: true,
        workspaceId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        acceptedByUserId: true
      }
    });

    if (!invite) {
      return { accepted: false, reason: 'not_found' };
    }

    if (invite.acceptedAt) {
      return {
        accepted: invite.acceptedByUserId === input.userId,
        reason: invite.acceptedByUserId === input.userId ? undefined : 'already_accepted',
        workspaceId: invite.workspaceId
      };
    }

    if (invite.revokedAt) {
      return { accepted: false, reason: 'revoked' };
    }

    if (invite.expiresAt <= new Date()) {
      return { accepted: false, reason: 'expired' };
    }

    if (normalizeEmail(invite.email) !== userEmail) {
      return { accepted: false, reason: 'email_mismatch' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMembership.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: input.userId
          }
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: input.userId,
          role: invite.role
        },
        update: {}
      });

      await tx.workspaceInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        },
        data: {
          acceptedByUserId: input.userId,
          acceptedAt: new Date()
        }
      });
    });

    return { accepted: true, workspaceId: invite.workspaceId };
  }

  private resolveInviteStatus(input: {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  }): 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' {
    if (input.acceptedAt) {
      return 'ACCEPTED';
    }
    if (input.revokedAt) {
      return 'REVOKED';
    }
    if (input.expiresAt <= new Date()) {
      return 'EXPIRED';
    }
    return 'PENDING';
  }

  private async sendInviteEmail(invite: InviteProjection, rawToken: string): Promise<void> {
    if (!this.emailService) {
      return;
    }

    const inviteUrl = `${env.APP_URL}/login?invite=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(invite.email)}&step=register`;
    await this.emailService.sendWorkspaceInviteEmail(invite.email, {
      workspaceName: invite.workspace.name,
      inviterName: invite.invitedBy.name,
      inviteUrl,
      role: invite.role
    });

    logger.info({
      event: 'workspace.invite.sent',
      workspaceId: invite.workspace.id,
      inviteId: invite.id,
      to: invite.email,
      role: invite.role
    });
  }
}
