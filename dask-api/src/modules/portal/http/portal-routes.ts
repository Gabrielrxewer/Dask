import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import { AppError } from '@/core/errors/app-error';
import { normalizeEmail } from '@/modules/identity/domain/password-policy';
import type { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import {
  hashBillingPortalToken,
  verifyBillingPortalToken
} from '@/modules/billing/domain/portal-token';

const onboardByDocumentDto = z.object({
  docToken: z.string().min(1)
});

const onboardByBillingDto = z.object({
  billingToken: z.string().min(1)
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

interface BillingPortalTokenRow {
  id: string;
  workspaceId: string;
  orderId: string;
  tokenId: string;
  tokenHash: string;
  customerEmail: string | null;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
}

interface BillingPortalTokenDelegate {
  findUnique(input: { where: { tokenId: string } }): Promise<BillingPortalTokenRow | null>;
  update(input: { where: { id: string }; data: { lastAccessedAt: Date } }): Promise<BillingPortalTokenRow>;
}

function billingPortalTokens(prisma: PrismaClient): BillingPortalTokenDelegate {
  return (prisma as unknown as PrismaClient & { billingPortalToken: BillingPortalTokenDelegate }).billingPortalToken;
}

async function ensureClientMembership(prisma: PrismaClient, workspaceId: string, userId: string) {
  const existing = await prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }
  });

  if (existing) {
    return existing;
  }

  return prisma.workspaceMembership.create({
    data: {
      workspaceId,
      userId,
      role: 'CLIENT'
    }
  });
}

async function ensureCustomerForPortal(input: {
  prisma: PrismaClient;
  workspaceId: string;
  userId: string;
  userEmail: string;
  userName: string;
}) {
  const email = normalizeEmail(input.userEmail);
  if (!email) {
    return null;
  }

  const existing = await input.prisma.customer.findFirst({
    where: {
      workspaceId: input.workspaceId,
      email: { equals: email, mode: 'insensitive' }
    },
    select: { id: true }
  });

  if (existing) {
    return existing.id;
  }

  const customer = await input.prisma.customer.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.userName.trim() || email,
      email,
      status: 'active',
      createdBy: input.userId,
      updatedBy: input.userId
    },
    select: { id: true }
  });

  return customer.id;
}

async function linkCustomerIdToUser(
  prisma: PrismaClient,
  workspaceId: string,
  customerId: string,
  userId: string
) {
  await prisma.workspaceCustomerUser.upsert({
    where: { workspaceId_customerId_userId: { workspaceId, customerId, userId } },
    create: { workspaceId, customerId, userId, createdBy: userId },
    update: {}
  });
}

async function findCustomerIdByEmail(prisma: PrismaClient, workspaceId: string, userEmail: string) {
  const customer = await prisma.customer.findFirst({
    where: {
      workspaceId,
      email: { equals: userEmail, mode: 'insensitive' }
    },
    select: { id: true }
  });

  return customer?.id ?? null;
}

const ANCHOR_PREFERRED_COLUMN_SLUGS = ['billing_created', 'contract_accepted', 'paid_active', 'doing', 'in-progress'];
const ANCHOR_PREFERRED_STATE_SLUGS = ['billing_created', 'contract_accepted', 'paid_active', 'doing', 'in-progress'];

async function resolveAnchorPlacement(prisma: PrismaClient, workspaceId: string) {
  const [board, allColumns, allStates, type] = await Promise.all([
    prisma.board.findFirst({
      where: { workspaceId },
      select: { id: true },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.boardColumn.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, slug: true },
      orderBy: { position: 'asc' }
    }),
    prisma.workflowState.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, slug: true },
      orderBy: { position: 'asc' }
    }),
    prisma.workItemType.findFirst({
      where: { workspaceId, isActive: true },
      select: { id: true, slug: true },
      orderBy: { position: 'asc' }
    })
  ]);

  const column =
    allColumns.find((c) => ANCHOR_PREFERRED_COLUMN_SLUGS.includes(c.slug)) ?? allColumns[0] ?? null;
  const state =
    allStates.find((s) => ANCHOR_PREFERRED_STATE_SLUGS.includes(s.slug)) ?? allStates[0] ?? null;

  return { board, column, state, type };
}

async function ensureAnchorWorkItem(input: {
  prisma: PrismaClient;
  workspaceId: string;
  customerId: string;
  userId: string;
  userName: string;
}) {
  const existing = await input.prisma.item.findFirst({
    where: {
      workspaceId: input.workspaceId,
      assigneeId: input.userId,
      OR: [
        { metadata: { path: ['clientAnchorCustomerId'], equals: input.customerId } },
        { metadata: { path: ['customerId'], equals: input.customerId } },
        { fields: { path: ['customerId'], equals: input.customerId } }
      ]
    },
    select: { id: true, fields: true, metadata: true }
  });

  if (existing) {
    await input.prisma.item.update({
      where: { id: existing.id },
      data: {
        fields: {
          ...asRecord(existing.fields),
          customerId: input.customerId
        },
        metadata: {
          ...asRecord(existing.metadata),
          isClientAnchor: true,
          customerId: input.customerId,
          clientAnchorCustomerId: input.customerId,
          clientUserId: input.userId
        },
        updatedBy: input.userId
      }
    });
    return existing.id;
  }

  const { board, column, state, type } = await resolveAnchorPlacement(input.prisma, input.workspaceId);

  if (!board) return null;

  const item = await input.prisma.item.create({
    data: {
      id: randomUUID(),
      boardId: board.id,
      workspaceId: input.workspaceId,
      columnId: column?.id ?? null,
      boardColumnId: column?.id ?? null,
      type: type?.slug ?? 'task',
      typeId: type?.id ?? null,
      status: state?.slug ?? 'backlog',
      stateId: state?.id ?? null,
      title: `Portal do cliente - ${input.userName}`,
      description: 'Item ancora do portal do cliente para documentos, cobrancas e atividades.',
      fields: { customerId: input.customerId },
      assigneeId: input.userId,
      createdBy: input.userId,
      updatedBy: input.userId,
      metadata: {
        isClientAnchor: true,
        customerId: input.customerId,
        clientAnchorCustomerId: input.customerId,
        clientUserId: input.userId
      }
    },
    select: { id: true }
  });

  return item.id;
}

async function attachDocumentToClientAnchor(input: {
  prisma: PrismaClient;
  workspaceId: string;
  documentId: string;
  customerId: string;
  userId: string;
  anchorItemId: string | null;
}) {
  const document = await input.prisma.workspaceDocument.findFirst({
    where: { id: input.documentId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true }
  });

  if (!document) {
    return;
  }

  await input.prisma.workspaceDocument.update({
    where: { id: document.id },
    data: {
      metadata: {
        ...asRecord(document.metadata),
        customerId: input.customerId,
        clientAnchorItemId: input.anchorItemId,
        clientUserId: input.userId
      },
      updatedBy: input.userId
    }
  });

  if (input.anchorItemId) {
    await input.prisma.workItemDocumentLink.upsert({
      where: {
        itemId_documentId: {
          itemId: input.anchorItemId,
          documentId: input.documentId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        itemId: input.anchorItemId,
        documentId: input.documentId,
        linkedBy: input.userId
      },
      update: {}
    });
  }
}

async function attachBillingToClientAnchor(input: {
  prisma: PrismaClient;
  orderId: string;
  customerId: string;
  userId: string;
  anchorItemId: string | null;
}) {
  const order = await input.prisma.connectPaymentOrder.findUnique({
    where: { id: input.orderId },
    select: { metadata: true }
  });

  if (!order) {
    return;
  }

  await input.prisma.connectPaymentOrder.update({
    where: { id: input.orderId },
    data: {
      metadata: {
        ...asRecord(order.metadata),
        customerId: input.customerId,
        clientAnchorItemId: input.anchorItemId,
        clientUserId: input.userId
      }
    }
  });
}

export const buildPortalRoutes = (deps: {
  prisma: PrismaClient;
  workspaceDocumentsService: WorkspaceDocumentsService;
  billingPortalTokenSecret: string;
}): Router => {
  const router = Router();

  router.post(
    '/portal/onboard',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const userId = req.auth!.userId;

      const user = await deps.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true }
      });

      if (!user) {
        throw new AppError('User not found.', 404);
      }

      const body = req.body as { docToken?: unknown; billingToken?: unknown };

      if (body.docToken !== undefined) {
        const { docToken } = onboardByDocumentDto.parse(body);
        const resolved = await deps.workspaceDocumentsService.resolvePublicDocumentToken({
          token: docToken,
          includeRecipients: true
        });

        if (!resolved.recipientEmail || normalizeEmail(user.email) !== normalizeEmail(resolved.recipientEmail)) {
          throw new AppError(
            'Este documento foi enviado para outro endereco de e-mail.',
            403,
            { code: 'RECIPIENT_EMAIL_MISMATCH' }
          );
        }

        const customerId = await ensureCustomerForPortal({
          prisma: deps.prisma,
          workspaceId: resolved.workspaceId,
          userId,
          userEmail: user.email,
          userName: user.name
        });

        if (!customerId) {
          throw new AppError('Nao foi possivel vincular o cliente ao workspace.', 409);
        }

        await ensureClientMembership(deps.prisma, resolved.workspaceId, userId);
        await linkCustomerIdToUser(deps.prisma, resolved.workspaceId, customerId, userId);

        const anchorItemId = await ensureAnchorWorkItem({
          prisma: deps.prisma,
          workspaceId: resolved.workspaceId,
          customerId,
          userId,
          userName: user.name
        });

        await attachDocumentToClientAnchor({
          prisma: deps.prisma,
          workspaceId: resolved.workspaceId,
          documentId: resolved.documentId,
          customerId,
          userId,
          anchorItemId
        });

        res.status(200).json({
          workspaceSlug: resolved.workspaceSlug,
          workspaceName: resolved.workspaceName,
          documentId: resolved.documentId,
          documentKind: resolved.documentKind,
          customerId,
          anchorItemId
        });
        return;
      }

      if (body.billingToken !== undefined) {
        const { billingToken } = onboardByBillingDto.parse(body);
        let tokenClaims: ReturnType<typeof verifyBillingPortalToken>;

        if (!deps.billingPortalTokenSecret.trim()) {
          throw new AppError('Billing portal token secret is not configured.', 503, {
            code: 'BILLING_PORTAL_TOKEN_SECRET_MISSING'
          });
        }

        try {
          tokenClaims = verifyBillingPortalToken(billingToken, deps.billingPortalTokenSecret);
        } catch {
          throw new AppError('Link de cobranca invalido.', 404, { code: 'BILLING_TOKEN_INVALID' });
        }

        const order = await deps.prisma.connectPaymentOrder.findFirst({
          where: {
            id: tokenClaims.orderId,
            workspaceId: tokenClaims.workspaceId
          },
          include: {
            workspace: { select: { id: true, key: true, name: true } }
          }
        });

        if (!order) {
          throw new AppError('Link de cobranca invalido.', 404, { code: 'BILLING_TOKEN_INVALID' });
        }

        const tokenHash = hashBillingPortalToken(billingToken);
        const tokenRecord = await billingPortalTokens(deps.prisma).findUnique({
          where: { tokenId: tokenClaims.jti }
        });

        if (tokenRecord) {
          if (
            tokenRecord.workspaceId !== order.workspaceId ||
            tokenRecord.orderId !== order.id ||
            tokenRecord.tokenHash !== tokenHash
          ) {
            throw new AppError('Link de cobranca invalido.', 404, { code: 'BILLING_TOKEN_INVALID' });
          }
          if (tokenRecord.revokedAt) {
            throw new AppError('Link de cobranca revogado.', 403, { code: 'BILLING_TOKEN_REVOKED' });
          }
          if (tokenRecord.expiresAt.getTime() <= Date.now()) {
            throw new AppError('Link de cobranca expirado.', 403, { code: 'BILLING_TOKEN_EXPIRED' });
          }
          if (!tokenRecord.scopes.includes('view')) {
            throw new AppError('Link de cobranca sem escopo de visualizacao.', 403, { code: 'BILLING_TOKEN_SCOPE_DENIED' });
          }
        } else {
          const orderMetadata = asRecord(order.metadata);
          const expectedHash = typeof orderMetadata.clientPortalTokenHash === 'string'
            ? orderMetadata.clientPortalTokenHash
            : '';
          const expectedTokenId = typeof orderMetadata.clientPortalTokenId === 'string'
            ? orderMetadata.clientPortalTokenId
            : '';
          const revokedAt = typeof orderMetadata.clientPortalTokenRevokedAt === 'string'
            ? orderMetadata.clientPortalTokenRevokedAt.trim()
            : '';
          const expiresAt = typeof orderMetadata.clientPortalTokenExpiresAt === 'string'
            ? new Date(orderMetadata.clientPortalTokenExpiresAt)
            : null;

          if (
            expectedTokenId !== tokenClaims.jti ||
            expectedHash !== tokenHash
          ) {
            throw new AppError('Link de cobranca invalido.', 404, { code: 'BILLING_TOKEN_INVALID' });
          }
          if (revokedAt) {
            throw new AppError('Link de cobranca revogado.', 403, { code: 'BILLING_TOKEN_REVOKED' });
          }
          if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
            throw new AppError('Link de cobranca expirado.', 403, { code: 'BILLING_TOKEN_EXPIRED' });
          }
        }

        if (!tokenClaims.scopes.includes('view')) {
          throw new AppError('Link de cobranca sem escopo de visualizacao.', 403, { code: 'BILLING_TOKEN_SCOPE_DENIED' });
        }

        const expectedEmail = order.customerEmail ? normalizeEmail(order.customerEmail) : null;
        const tokenEmail = tokenRecord?.customerEmail
          ? normalizeEmail(tokenRecord.customerEmail)
          : tokenClaims.customerEmail
            ? normalizeEmail(tokenClaims.customerEmail)
            : expectedEmail;
        if (!expectedEmail || normalizeEmail(user.email) !== expectedEmail || tokenEmail !== expectedEmail) {
          throw new AppError(
            'Esta cobranca foi enviada para outro endereco de e-mail.',
            403,
            { code: 'RECIPIENT_EMAIL_MISMATCH' }
          );
        }

        const customerId =
          order.customerId ??
          await findCustomerIdByEmail(deps.prisma, order.workspaceId, user.email) ??
          await ensureCustomerForPortal({
            prisma: deps.prisma,
            workspaceId: order.workspaceId,
            userId,
            userEmail: user.email,
            userName: user.name
          });

        if (!customerId) {
          throw new AppError('Nao foi possivel vincular o cliente ao workspace.', 409);
        }

        await ensureClientMembership(deps.prisma, order.workspaceId, userId);
        await linkCustomerIdToUser(deps.prisma, order.workspaceId, customerId, userId);

        const anchorItemId = await ensureAnchorWorkItem({
          prisma: deps.prisma,
          workspaceId: order.workspaceId,
          customerId,
          userId,
          userName: user.name
        });

        await attachBillingToClientAnchor({
          prisma: deps.prisma,
          orderId: order.id,
          customerId,
          userId,
          anchorItemId
        });

        if (tokenRecord) {
          await billingPortalTokens(deps.prisma).update({
            where: { id: tokenRecord.id },
            data: { lastAccessedAt: new Date() }
          });
        } else {
          const currentOrderForAccessLog = await deps.prisma.connectPaymentOrder.findUnique({
            where: { id: order.id },
            select: { metadata: true }
          });

          await deps.prisma.connectPaymentOrder.update({
            where: { id: order.id },
            data: {
              metadata: {
                ...asRecord(currentOrderForAccessLog?.metadata),
                clientPortalTokenLastAccessedAt: new Date().toISOString()
              } as Prisma.InputJsonValue
            }
          });
        }

        res.status(200).json({
          workspaceSlug: order.workspace.key,
          workspaceName: order.workspace.name,
          orderId: order.id,
          paymentUrl: order.checkoutUrl,
          customerId,
          anchorItemId
        });
        return;
      }

      throw new AppError('Forneca docToken ou billingToken.', 400, { code: 'MISSING_TOKEN' });
    })
  );

  return router;
};
