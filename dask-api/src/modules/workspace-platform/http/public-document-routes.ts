import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware, optionalAuthMiddleware } from '@/core/http/auth-middleware';
import { SESSION_COOKIE_NAME } from '@/core/http/cookie-config';
import type { AuthService } from '@/modules/identity/application/auth-service';
import type { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import {
  decidePublicWorkspaceDocumentDto,
  publicWorkspaceDocumentAssetParamsDto,
  publicWorkspaceDocumentTokenParamsDto
} from '@/modules/workspace-platform/http/dto';

export const publicDocumentAccessMatrix = {
  preview: {
    method: 'GET',
    path: '/documents/public/:token',
    token: 'required, valid, non-expired, non-revoked, sent commercial document',
    session: 'optional for requireLogin=false; required recipient session for requireLogin=true',
    result: 'full public preview or authenticated recipient view; never returns the raw token'
  },
  assetPreview: {
    method: 'GET',
    path: '/documents/public/:token/assets/:assetId/content',
    token: 'required and scoped to the same document',
    session: 'same rule as preview',
    result: 'serves only assets attached to the token document'
  },
  resolve: {
    method: 'GET',
    path: '/documents/public/:token/resolve',
    token: 'required, valid, non-expired, non-revoked, sent commercial document',
    session: 'not required',
    result: 'workspace/document routing hints only; never returns the raw token'
  },
  decision: {
    method: 'POST',
    path: '/documents/public/:token/decision',
    token: 'required, valid, non-expired, non-revoked, sent commercial document',
    session: 'required recipient session',
    result: 'accept/reject only when allowAcceptReject is enabled and decision is valid for document kind'
  }
} as const;

export const buildPublicDocumentRoutes = (deps: {
  authService: AuthService;
  workspaceDocumentsService: WorkspaceDocumentsService;
}): Router => {
  const router = Router();

  router.get(
    '/documents/public/:token',
    optionalAuthMiddleware,
    asyncHandler(async (req, res) => {
      const { token } = publicWorkspaceDocumentTokenParamsDto.parse(req.params);
      const rawRefreshToken = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
      const sessionUser = req.auth
        ? null
        : await deps.authService.resolveSessionUser(rawRefreshToken);
      const document = await deps.workspaceDocumentsService.getPublicCommercialDocument({
        token,
        requestingUserId: req.auth?.userId ?? sessionUser?.userId ?? null,
        requestingUserEmail: req.auth?.email ?? sessionUser?.email ?? null
      });
      res.status(200).json(document);
    })
  );

  router.get(
    '/documents/public/:token/assets/:assetId/content',
    optionalAuthMiddleware,
    asyncHandler(async (req, res) => {
      const { token, assetId } = publicWorkspaceDocumentAssetParamsDto.parse(req.params);
      const rawRefreshToken = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
      const sessionUser = req.auth
        ? null
        : await deps.authService.resolveSessionUser(rawRefreshToken);
      const asset = await deps.workspaceDocumentsService.getPublicDocumentAssetContent({
        token,
        assetId,
        requestingUserId: req.auth?.userId ?? sessionUser?.userId ?? null,
        requestingUserEmail: req.auth?.email ?? sessionUser?.email ?? null
      });
      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('Content-Length', String(asset.size));
      res.setHeader('Content-Disposition', `inline; filename="${asset.filename.replace(/"/g, '')}"`);
      res.sendFile(asset.absolutePath);
    })
  );

  router.get(
    '/documents/public/:token/resolve',
    asyncHandler(async (req, res) => {
      const { token } = publicWorkspaceDocumentTokenParamsDto.parse(req.params);
      const result = await deps.workspaceDocumentsService.resolvePublicDocumentToken({ token });
      res.status(200).json(result);
    })
  );

  router.post(
    '/documents/public/:token/decision',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const { token } = publicWorkspaceDocumentTokenParamsDto.parse(req.params);
      const payload = decidePublicWorkspaceDocumentDto.parse(req.body);
      const document = await deps.workspaceDocumentsService.decidePublicCommercialDocument({
        token,
        userId: req.auth!.userId,
        decision: payload.decision,
        requestContext: {
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined
        }
      });
      res.status(200).json(document);
    })
  );

  return router;
};
