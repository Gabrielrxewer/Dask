import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/core/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { LeadsService } from '@/modules/leads/application/leads-service';
import {
  captureLeadDto,
  convertLeadDto,
  distributeLeadDto,
  followUpDto,
  leadListQueryDto,
  leadParamsDto,
  markLostDto,
  nurtureTouchDto,
  qualifyLeadDto,
  workspaceParamsDto
} from '@/modules/leads/http/dto';
import type { PrismaClient } from '@prisma/client';

export const buildLeadsRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  leadsService: LeadsService;
}): Router => {
  const router = Router();

  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireLeadRead = requireWorkspacePermission(deps.authorizationService, 'lead.read');
  const requireLeadCapture = requireWorkspacePermission(deps.authorizationService, 'lead.capture');
  const requireLeadQualify = requireWorkspacePermission(deps.authorizationService, 'lead.qualify');
  const requireLeadDistribute = requireWorkspacePermission(deps.authorizationService, 'lead.distribute');
  const requireLeadNurture = requireWorkspacePermission(deps.authorizationService, 'lead.nurture');
  const requireLeadConvert = requireWorkspacePermission(deps.authorizationService, 'lead.convert');

  router.use('/leads/workspaces/:workspaceId', resolveWorkspaceScope, requireWorkspaceModule('leads'));

  router.get(
    '/leads/workspaces/:workspaceId/dashboard',
    requireLeadRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const dashboard = await deps.leadsService.getDashboard(workspaceId);
      res.status(200).json(dashboard);
    })
  );

  router.get(
    '/leads/workspaces/:workspaceId/leads',
    requireLeadRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = leadListQueryDto.parse(req.query ?? {});
      const items = await deps.leadsService.listLeads({
        workspaceId,
        status: query.status,
        ownerUserId: query.ownerUserId,
        qualificationStatus: query.qualificationStatus,
        distributionStatus: query.distributionStatus,
        search: query.search,
        limit: query.limit
      });
      res.status(200).json({ items });
    })
  );

  router.post(
    '/leads/workspaces/:workspaceId/leads',
    requireLeadCapture,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = captureLeadDto.parse(req.body ?? {});
      const lead = await deps.leadsService.captureLead({
        workspaceId,
        ...payload,
        createdByUserId: req.auth?.userId ?? null
      });
      res.status(201).json(lead);
    })
  );

  router.get(
    '/leads/workspaces/:workspaceId/leads/:leadId',
    requireLeadRead,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const details = await deps.leadsService.getLeadDetails(workspaceId, leadId);
      res.status(200).json(details);
    })
  );

  router.patch(
    '/leads/workspaces/:workspaceId/leads/:leadId/qualify',
    requireLeadQualify,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = qualifyLeadDto.parse(req.body ?? {});
      const updated = await deps.leadsService.qualifyLead({
        workspaceId,
        leadId,
        qualificationStatus: payload.qualificationStatus,
        score: payload.score,
        temperature: payload.temperature,
        notes: payload.notes,
        qualifiedByUserId: req.auth?.userId ?? null
      });

      res.status(200).json(updated);
    })
  );

  router.patch(
    '/leads/workspaces/:workspaceId/leads/:leadId/distribute',
    requireLeadDistribute,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = distributeLeadDto.parse(req.body ?? {});
      const updated = await deps.leadsService.distributeLead({
        workspaceId,
        leadId,
        toUserId: payload.toUserId,
        strategy: payload.strategy,
        reason: payload.reason,
        distributedByUserId: req.auth?.userId ?? null
      });

      res.status(200).json(updated);
    })
  );

  router.post(
    '/leads/workspaces/:workspaceId/leads/:leadId/follow-ups',
    requireLeadRead,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = followUpDto.parse(req.body ?? {});
      const updated = await deps.leadsService.registerFollowUp({
        workspaceId,
        leadId,
        note: payload.note,
        nextFollowUpAt: payload.nextFollowUpAt,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(updated);
    })
  );

  router.post(
    '/leads/workspaces/:workspaceId/leads/:leadId/nurture',
    requireLeadNurture,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = nurtureTouchDto.parse(req.body ?? {});
      const result = await deps.leadsService.registerNurtureTouch({
        workspaceId,
        leadId,
        channel: payload.channel,
        templateKey: payload.templateKey,
        subject: payload.subject,
        message: payload.message,
        scheduledAt: payload.scheduledAt,
        sentAt: payload.sentAt,
        metadata: payload.metadata,
        actorUserId: req.auth?.userId ?? null
      });

      res.status(201).json(result);
    })
  );

  router.post(
    '/leads/workspaces/:workspaceId/leads/:leadId/convert',
    requireLeadConvert,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = convertLeadDto.parse(req.body ?? {});
      const updated = await deps.leadsService.convertLead({
        workspaceId,
        leadId,
        conversionType: payload.conversionType,
        conversionRef: payload.conversionRef,
        amount: payload.amount,
        currency: payload.currency,
        notes: payload.notes,
        convertedByUserId: req.auth?.userId ?? null
      });

      res.status(200).json(updated);
    })
  );

  router.post(
    '/leads/workspaces/:workspaceId/leads/:leadId/lost',
    requireLeadDistribute,
    asyncHandler(async (req, res) => {
      const { workspaceId, leadId } = leadParamsDto.parse(req.params);
      const payload = markLostDto.parse(req.body ?? {});
      const updated = await deps.leadsService.markLeadAsLost({
        workspaceId,
        leadId,
        reason: payload.reason,
        actorUserId: req.auth?.userId ?? null
      });

      res.status(200).json(updated);
    })
  );

  return router;
};
