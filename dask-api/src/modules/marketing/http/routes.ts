import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { MarketingService } from '@/modules/marketing/application/marketing-service';
import {
  aiGenerateCampaignDto,
  aiImproveVariantDto,
  audienceQueryDto,
  campaignListQueryDto,
  campaignParamsDto,
  campaignVariantParamsDto,
  createAutomationFlowDto,
  createCampaignDto,
  createSegmentDto,
  createTemplateDto,
  scheduleCampaignDto,
  segmentParamsDto,
  sendTestEmailDto,
  templateParamsDto,
  updateCampaignDto,
  updateSegmentDto,
  updateTemplateDto,
  workspaceParamsDto
} from '@/modules/marketing/http/dto';
import type { PrismaClient } from '@prisma/client';

export const buildMarketingRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  marketingService: MarketingService;
}): Router => {
  const router = Router();

  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireMarketingView = requireWorkspacePermission(deps.authorizationService, 'marketing.view');
  const requireCampaignCreate = requireWorkspacePermission(deps.authorizationService, 'marketing.campaign.create');
  const requireCampaignApprove = requireWorkspacePermission(deps.authorizationService, 'marketing.campaign.approve');
  const requireCampaignSend = requireWorkspacePermission(deps.authorizationService, 'marketing.campaign.send');
  const requireTemplateManage = requireWorkspacePermission(deps.authorizationService, 'marketing.template.manage');
  const requireSegmentManage = requireWorkspacePermission(deps.authorizationService, 'marketing.segment.manage');
  const requireAnalytics = requireWorkspacePermission(deps.authorizationService, 'marketing.analytics.view');
  const requireSenderConfig = requireWorkspacePermission(deps.authorizationService, 'marketing.sender.manage');

  router.use('/marketing/workspaces/:workspaceId', resolveWorkspaceScope, requireWorkspaceModule('marketing'));

  router.get(
    '/marketing/workspaces/:workspaceId/dashboard',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const dashboard = await deps.marketingService.getDashboard(workspaceId);
      res.status(200).json(dashboard);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/campaigns',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = campaignListQueryDto.parse(req.query ?? {});
      const items = await deps.marketingService.listCampaigns({
        workspaceId,
        status: query.status,
        objective: query.objective,
        search: query.search,
        limit: query.limit
      });

      res.status(200).json({ items });
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns',
    requireCampaignCreate,
    requireSenderConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createCampaignDto.parse(req.body ?? {});
      const campaign = await deps.marketingService.createCampaign({
        workspaceId,
        ...payload,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(201).json(campaign);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const campaign = await deps.marketingService.getCampaignDetails(workspaceId, campaignId);
      res.status(200).json(campaign);
    })
  );

  router.patch(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId',
    requireCampaignCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const patch = updateCampaignDto.parse(req.body ?? {});
      const campaign = await deps.marketingService.updateCampaign({
        workspaceId,
        campaignId,
        patch,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(campaign);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/submit-review',
    requireCampaignCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const campaign = await deps.marketingService.submitCampaignForReview({
        workspaceId,
        campaignId,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(campaign);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/approve',
    requireCampaignApprove,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const campaign = await deps.marketingService.approveCampaign({
        workspaceId,
        campaignId,
        actorUserId: req.auth!.userId
      });
      res.status(200).json(campaign);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/schedule',
    requireCampaignApprove,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const payload = scheduleCampaignDto.parse(req.body ?? {});
      const campaign = await deps.marketingService.scheduleCampaign({
        workspaceId,
        campaignId,
        scheduledAt: payload.scheduledAt,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(campaign);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/send-test',
    requireCampaignCreate,
    requireCampaignSend,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const payload = sendTestEmailDto.parse(req.body ?? {});
      const result = await deps.marketingService.sendTestEmail({
        workspaceId,
        campaignId,
        to: payload.to,
        subject: payload.subject,
        content: payload.content,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(result);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/launch',
    requireCampaignSend,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const result = await deps.marketingService.launchCampaign({
        workspaceId,
        campaignId,
        actorUserId: req.auth?.userId ?? null,
        dryRun: req.query.dryRun === 'true'
      });
      res.status(200).json(result);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/analytics',
    requireAnalytics,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId } = campaignParamsDto.parse(req.params);
      const analytics = await deps.marketingService.listCampaignAnalytics({
        workspaceId,
        campaignId
      });
      res.status(200).json(analytics);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/audience/contacts',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = audienceQueryDto.parse(req.query ?? {});
      const contacts = await deps.marketingService.listAudienceContacts({
        workspaceId,
        search: query.search,
        stage: query.stage,
        consentStatus: query.consentStatus,
        limit: query.limit
      });

      res.status(200).json({ items: contacts });
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/audience/segments',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const segments = await deps.marketingService.listSegments(workspaceId);
      res.status(200).json({ items: segments });
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/audience/segments',
    requireSegmentManage,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createSegmentDto.parse(req.body ?? {});
      const segment = await deps.marketingService.createSegment({
        workspaceId,
        ...payload,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(201).json(segment);
    })
  );

  router.patch(
    '/marketing/workspaces/:workspaceId/audience/segments/:segmentId',
    requireSegmentManage,
    asyncHandler(async (req, res) => {
      const { workspaceId, segmentId } = segmentParamsDto.parse(req.params);
      const patch = updateSegmentDto.parse(req.body ?? {});
      const segment = await deps.marketingService.updateSegment({
        workspaceId,
        segmentId,
        patch,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(segment);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/audience/segments/:segmentId/preview',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId, segmentId } = segmentParamsDto.parse(req.params);
      const preview = await deps.marketingService.previewSegment({
        workspaceId,
        segmentId,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      });

      res.status(200).json(preview);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/templates',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const templates = await deps.marketingService.listTemplates(workspaceId);
      res.status(200).json({ items: templates });
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/templates',
    requireTemplateManage,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createTemplateDto.parse(req.body ?? {});
      const template = await deps.marketingService.createTemplate({
        workspaceId,
        ...payload,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(201).json(template);
    })
  );

  router.patch(
    '/marketing/workspaces/:workspaceId/templates/:templateId',
    requireTemplateManage,
    asyncHandler(async (req, res) => {
      const { workspaceId, templateId } = templateParamsDto.parse(req.params);
      const patch = updateTemplateDto.parse(req.body ?? {});
      const template = await deps.marketingService.updateTemplate({
        workspaceId,
        templateId,
        patch,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(template);
    })
  );

  router.get(
    '/marketing/workspaces/:workspaceId/automations/flows',
    requireMarketingView,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const flows = await deps.marketingService.listAutomationFlows(workspaceId);
      res.status(200).json({ items: flows });
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/automations/flows',
    requireCampaignCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createAutomationFlowDto.parse(req.body ?? {});
      const flow = await deps.marketingService.createAutomationFlow({
        workspaceId,
        ...payload,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(201).json(flow);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/ai/generate-campaign',
    requireCampaignCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = aiGenerateCampaignDto.parse(req.body ?? {});
      const campaign = await deps.marketingService.generateCampaignWithAI({
        workspaceId,
        ...payload,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(201).json(campaign);
    })
  );

  router.post(
    '/marketing/workspaces/:workspaceId/campaigns/:campaignId/variants/:variantId/ai-improve',
    requireCampaignCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId, campaignId, variantId } = campaignVariantParamsDto.parse(req.params);
      const payload = aiImproveVariantDto.parse(req.body ?? {});
      const campaign = await deps.marketingService.improveVariantWithAI({
        workspaceId,
        campaignId,
        variantId,
        objective: payload.objective,
        tone: payload.tone,
        actorUserId: req.auth?.userId ?? null
      });
      res.status(200).json(campaign);
    })
  );

  return router;
};

