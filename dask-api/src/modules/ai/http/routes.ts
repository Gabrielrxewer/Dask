import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/core/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { AIAgentService } from '@/modules/ai/application/ai-agent-service';
import type { ImprovementRequestService } from '@/modules/ai/application/improvement-request-service';
import {
  aiWorkspaceParamsDto,
  aiWorkspaceAgentParamsDto,
  aiWorkspaceItemAgentParamsDto,
  aiWorkspaceItemParamsDto,
  createAiAgentDto,
  patchAiAgentDto,
  listAiRunsQueryDto,
  runAgentOnItemDto,
  runRiskAnalysisDto,
  runDocumentationAssistantDto
} from '@/modules/ai/http/dto';

export const buildAiRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  improvementRequestService: ImprovementRequestService;
  aiAgentService: AIAgentService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireAiUse = requireWorkspacePermission(deps.authorizationService, 'ai.use');

  router.use('/ai/workspaces/:workspaceId', resolveWorkspaceScope, requireAiUse);

  router.post(
    '/items/:itemId/ai/improve-description',
    asyncHandler(async (req, res) => {
      await deps.improvementRequestService.requestDescriptionImprovement({
        itemId: req.params.itemId,
        requestedBy: req.auth!.userId
      });
      res.status(202).json({
        status: 'queued'
      });
    })
  );

  router.get(
    '/ai/workspaces/:workspaceId/agents',
    asyncHandler(async (req, res) => {
      const { workspaceId } = aiWorkspaceParamsDto.parse(req.params);
      const agents = await deps.aiAgentService.listAgents({ workspaceId });
      res.status(200).json(agents);
    })
  );

  router.post(
    '/ai/workspaces/:workspaceId/agents',
    asyncHandler(async (req, res) => {
      const { workspaceId } = aiWorkspaceParamsDto.parse(req.params);
      const payload = createAiAgentDto.parse(req.body);
      const agent = await deps.aiAgentService.createAgent({
        workspaceId,
        ...payload
      });
      res.status(201).json(agent);
    })
  );

  router.patch(
    '/ai/workspaces/:workspaceId/agents/:agentId',
    asyncHandler(async (req, res) => {
      const params = aiWorkspaceAgentParamsDto.parse(req.params);
      const patch = patchAiAgentDto.parse(req.body);
      const agent = await deps.aiAgentService.updateAgent({
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        patch
      });
      res.status(200).json(agent);
    })
  );

  router.get(
    '/ai/workspaces/:workspaceId/items/:itemId/context',
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId } = aiWorkspaceItemParamsDto.parse(req.params);
      const includeSemanticContext = req.query.includeSemanticContext !== 'false';
      const topKContextDocs = Math.min(Number(req.query.topKContextDocs ?? 5), 10);
      const context = await deps.aiAgentService.getItemContext({
        workspaceId,
        itemId,
        includeSemanticContext,
        topKContextDocs: Number.isFinite(topKContextDocs) && topKContextDocs > 0 ? topKContextDocs : 5
      });
      res.status(200).json(context);
    })
  );

  router.get(
    '/ai/workspaces/:workspaceId/runs',
    asyncHandler(async (req, res) => {
      const { workspaceId } = aiWorkspaceParamsDto.parse(req.params);
      const query = listAiRunsQueryDto.parse(req.query);
      const runs = await deps.aiAgentService.listRuns({
        workspaceId,
        itemId: query.itemId,
        limit: query.limit
      });
      res.status(200).json(runs);
    })
  );

  router.get(
    '/ai/workspaces/:workspaceId/observability',
    asyncHandler(async (req, res) => {
      const { workspaceId } = aiWorkspaceParamsDto.parse(req.params);
      const observability = await deps.aiAgentService.getObservability({ workspaceId });
      res.status(200).json(observability);
    })
  );

  router.post(
    '/ai/workspaces/:workspaceId/items/:itemId/agents/:agentId/run',
    asyncHandler(async (req, res) => {
      const params = aiWorkspaceItemAgentParamsDto.parse(req.params);
      const payload = runAgentOnItemDto.parse(req.body);
      const run = await deps.aiAgentService.runAgentOnItem({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        agentId: params.agentId,
        requestedBy: req.auth!.userId,
        instruction: payload.instruction,
        includeSemanticContext: payload.includeSemanticContext,
        topKContextDocs: payload.topKContextDocs
      });
      res.status(200).json(run);
    })
  );

  router.post(
    '/ai/workspaces/:workspaceId/items/:itemId/risk-analysis',
    asyncHandler(async (req, res) => {
      const params = aiWorkspaceItemParamsDto.parse(req.params);
      const payload = runRiskAnalysisDto.parse(req.body ?? {});
      const run = await deps.aiAgentService.runRiskAnalysis({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        requestedBy: req.auth!.userId,
        includeSemanticContext: payload.includeSemanticContext,
        topKContextDocs: payload.topKContextDocs
      });
      res.status(200).json(run);
    })
  );

  router.post(
    '/ai/workspaces/:workspaceId/documentation/run',
    asyncHandler(async (req, res) => {
      const { workspaceId } = aiWorkspaceParamsDto.parse(req.params);
      const payload = runDocumentationAssistantDto.parse(req.body ?? {});
      const run = await deps.aiAgentService.runDocumentationAssistant({
        workspaceId,
        requestedBy: req.auth!.userId,
        mode: payload.mode,
        instruction: payload.instruction,
        documentTitle: payload.documentTitle,
        documentPath: payload.documentPath,
        documentContent: payload.documentContent,
        selection: payload.selection,
        conversationHistory: payload.conversationHistory,
        includeSemanticContext: payload.includeSemanticContext,
        topKContextDocs: payload.topKContextDocs
      });
      res.status(200).json(run);
    })
  );

  return router;
};
