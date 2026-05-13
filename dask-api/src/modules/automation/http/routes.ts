import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import {
  createDefaultAutomationGraph,
  getAutomationCapabilities
} from '@/modules/automation/application/automation-capabilities';
import type { AutomationRunObservabilityService } from '@/modules/automation/application/automation-run-observability-service';
import type { AutomationRunService } from '@/modules/automation/application/automation-run-service';
import type { AutomationViewService } from '@/modules/automation/application/automation-view-service';
import type { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import type { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';
import type { AutomationWorkflowVersionService } from '@/modules/automation/application/workflow-version-service';
import { AutomationNativeWorkflowService } from '@/modules/automation/application/native-workflow-service';
import {
  automationRunParamsDto,
  automationApprovalParamsDto,
  automationSideEffectParamsDto,
  automationViewColumnParamsDto,
  automationViewParamsDto,
  automationWorkflowParamsDto,
  automationWorkflowVersionParamsDto,
  cancelAutomationRunDto,
  cancelAutomationApprovalDto,
  assignCommunicationConversationDto,
  communicationConversationParamsDto,
  createAutomationViewColumnDto,
  createAutomationViewDto,
  createAutomationWorkflowDto,
  createAutomationWorkflowDraftVersionDto,
  createWhatsAppTemplateDto,
  itemPlacementParamsDto,
  installNativeAutomationWorkflowsDto,
  listCommunicationTemplatesQueryDto,
  listCommunicationInboxQueryDto,
  listAutomationApprovalsQueryDto,
  listAutomationRunArtifactsQueryDto,
  listAutomationRunsQueryDto,
  listAutomationWorkflowsQueryDto,
  listAutomationWorkflowVersionsQueryDto,
  listItemPlacementsParamsDto,
  listWhatsAppConsentsQueryDto,
  markWhatsAppTemplateApprovalStatusDto,
  patchAutomationWorkflowDto,
  patchAutomationViewColumnDto,
  patchAutomationViewDto,
  publishAutomationWorkflowVersionDto,
  reviewAutomationApprovalDto,
  linkCommunicationConversationWorkItemDto,
  communicationTemplateVersionParamsDto,
  replyCommunicationConversationDto,
  runAutomationWorkflowDto,
  simulateWhatsAppMockEventDto,
  updateCommunicationTemplateDraftVersionDto,
  updateAutomationWorkflowVersionDto,
  upsertItemPlacementDto,
  upsertWhatsAppConsentDto,
  workspaceIdParamsDto
} from '@/modules/automation/http/dto';
import { CommunicationConsentService } from '@/modules/automation/communication/communication-consent-service';
import { CommunicationConversationService } from '@/modules/automation/communication/communication-conversation-service';
import { CommunicationTemplateService } from '@/modules/automation/communication/communication-template-service';
import { maskCommunicationAddress } from '@/modules/automation/communication/communication-address';
import { MockWhatsAppEventSimulator } from '@/modules/automation/communication/mock-whatsapp-event-simulator';

export const buildAutomationRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  automationApprovalRequestService?: AutomationApprovalRequestService;
  automationWorkflowService: AutomationWorkflowService;
  automationWorkflowVersionService: AutomationWorkflowVersionService;
  automationWorkflowRunnerService: AutomationWorkflowRunnerService;
  automationRunService: AutomationRunService;
  automationRunObservabilityService: AutomationRunObservabilityService;
  automationViewService: AutomationViewService;
  automationNativeWorkflowService?: AutomationNativeWorkflowService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireWorkflowRead = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.read');
  const requireWorkflowCreate = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.create');
  const requireWorkflowUpdate = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.update');
  const requireWorkflowPublish = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.publish');
  const requireWorkflowRun = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.run');
  const requireWorkflowArchive = requireWorkspacePermission(deps.authorizationService, 'automation.workflows.archive');
  const requireRunsRead = requireWorkspacePermission(deps.authorizationService, 'automation.runs.read');
  const requireRunsCancel = requireWorkspacePermission(deps.authorizationService, 'automation.runs.cancel');
  const requireApprovalRead = requireWorkspacePermission(deps.authorizationService, 'automation.approvals.read');
  const requireApprovalApprove = requireWorkspacePermission(deps.authorizationService, 'automation.approvals.approve');
  const requireApprovalReject = requireWorkspacePermission(deps.authorizationService, 'automation.approvals.reject');
  const requireApprovalCancel = requireWorkspacePermission(deps.authorizationService, 'automation.approvals.cancel');
  const requireInboxRead = requireWorkspacePermission(deps.authorizationService, 'communication.inbox.read');
  const requireConversationRead = requireWorkspacePermission(deps.authorizationService, 'communication.conversation.read');
  const requireConversationReply = requireWorkspacePermission(deps.authorizationService, 'communication.inbox.reply');
  const requireConversationResolve = requireWorkspacePermission(deps.authorizationService, 'communication.conversation.resolve');
  const requireConversationArchive = requireWorkspacePermission(deps.authorizationService, 'communication.conversation.archive');
  const requireConversationAssign = requireWorkspacePermission(deps.authorizationService, 'communication.conversation.assign');
  const requireAutomationModule = requireWorkspaceModule('automation');
  const communicationConsentService = new CommunicationConsentService(deps.prisma);
  const communicationConversationService = new CommunicationConversationService(deps.prisma);
  const communicationTemplateService = new CommunicationTemplateService(deps.prisma);
  const mockWhatsAppEventSimulator = new MockWhatsAppEventSimulator(deps.prisma);
  const automationApprovalRequestService =
    deps.automationApprovalRequestService ?? new AutomationApprovalRequestService(deps.prisma);
  const automationNativeWorkflowService =
    deps.automationNativeWorkflowService ?? new AutomationNativeWorkflowService(deps.prisma);

  router.use('/automation/workspaces/:workspaceId', resolveWorkspaceScope, requireWorkflowRead, requireAutomationModule);
  router.use('/workspaces/:workspaceId/automation-workflows', resolveWorkspaceScope, requireWorkflowRead, requireAutomationModule);
  router.use('/workspaces/:workspaceId/automation-approvals', resolveWorkspaceScope, requireApprovalRead, requireAutomationModule);
  router.use('/workspaces/:workspaceId/communication', resolveWorkspaceScope, requireConversationRead, requireAutomationModule);

  router.get(
    '/automation/workspaces/:workspaceId/capabilities',
    asyncHandler(async (_req, res) => {
      res.status(200).json(getAutomationCapabilities());
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/native-workflows/install',
    requireWorkflowCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = installNativeAutomationWorkflowsDto.parse(req.body ?? {});
      const result = await automationNativeWorkflowService.installNativeWorkflows({
        workspaceId,
        nativeKeys: payload.nativeKeys,
        activate: payload.activate,
        installedById: req.auth!.userId
      });

      res.status(200).json(result);
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-workflows',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listAutomationWorkflowsQueryDto.parse(req.query);
      await automationNativeWorkflowService.installNativeCommercialWorkflows({
        workspaceId,
        activate: false,
        installedById: null
      });
      const workflows = await deps.automationWorkflowService.listWorkflows({
        workspaceId,
        status: query.status,
        limit: query.limit
      });

      res.status(200).json({ items: workflows });
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows',
    requireWorkflowCreate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createAutomationWorkflowDto.parse(req.body);
      const workflow = await deps.automationWorkflowService.createWorkflow({
        workspaceId,
        name: payload.name,
        description: payload.description,
        status: payload.status,
        createdById: req.auth!.userId
      });

      res.status(201).json(workflow);
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-workflows/:workflowId',
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const workflow = await deps.automationWorkflowService.getWorkflow(params);
      res.status(200).json(workflow);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/automation-workflows/:workflowId',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const payload = patchAutomationWorkflowDto.parse(req.body);
      const workflow = await deps.automationWorkflowService.updateWorkflow({
        ...params,
        name: payload.name,
        description: payload.description,
        status: payload.status
      });

      res.status(200).json(workflow);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/activate',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const workflow = await deps.automationWorkflowService.setWorkflowStatus({
        ...params,
        status: 'active'
      });
      res.status(200).json(workflow);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/pause',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const workflow = await deps.automationWorkflowService.setWorkflowStatus({
        ...params,
        status: 'paused'
      });
      res.status(200).json(workflow);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/archive',
    requireWorkflowArchive,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const workflow = await deps.automationWorkflowService.archiveWorkflow(params);
      res.status(200).json(workflow);
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions',
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const query = listAutomationWorkflowVersionsQueryDto.parse(req.query);
      const versions = await deps.automationWorkflowVersionService.listVersions({
        ...params,
        status: query.status,
        limit: query.limit
      });
      res.status(200).json({ items: versions });
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/draft',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const payload = createAutomationWorkflowDraftVersionDto.parse(req.body ?? {});
      const version = await deps.automationWorkflowVersionService.createDraftVersion({
        ...params,
        definition: payload.definition,
        graph: payload.graph ?? createDefaultAutomationGraph(),
        graphNodes: payload.graphNodes,
        graphEdges: payload.graphEdges
      });
      res.status(201).json(version);
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId',
    asyncHandler(async (req, res) => {
      const params = automationWorkflowVersionParamsDto.parse(req.params);
      const version = await deps.automationWorkflowVersionService.getVersion(params);
      res.status(200).json(version);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowVersionParamsDto.parse(req.params);
      const payload = updateAutomationWorkflowVersionDto.parse(req.body);
      const version = await deps.automationWorkflowVersionService.updateDraftVersion({
        ...params,
        definition: payload.definition,
        graph: payload.graph,
        graphNodes: payload.graphNodes,
        graphEdges: payload.graphEdges
      });
      res.status(200).json(version);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId/publish',
    requireWorkflowPublish,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowVersionParamsDto.parse(req.params);
      const payload = publishAutomationWorkflowVersionDto.parse(req.body ?? {});
      const version = await deps.automationWorkflowVersionService.publishVersion({
        ...params,
        publishedById: req.auth!.userId,
        activateWorkflow: payload.activateWorkflow
      });
      res.status(200).json(version);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/versions/:versionId/clone',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowVersionParamsDto.parse(req.params);
      const version = await deps.automationWorkflowVersionService.cloneVersion(params);
      res.status(201).json(version);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-workflows/:workflowId/run',
    requireWorkflowRun,
    asyncHandler(async (req, res) => {
      const params = automationWorkflowParamsDto.parse(req.params);
      const payload = runAutomationWorkflowDto.parse(req.body ?? {});
      const result = await deps.automationWorkflowRunnerService.startRun({
        ...params,
        triggerType: payload.triggerType,
        context: payload.context
      });

      res.status(202).json({
        runId: result.run.id,
        status: result.run.status,
        executionStatus: result.executionResult.status,
        executedNodeIds: result.executionResult.executedNodeIds
      });
    })
  );

  router.get(
    '/workspaces/:workspaceId/communication/inbox',
    requireInboxRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listCommunicationInboxQueryDto.parse(req.query);
      const conversations = await communicationConversationService.listConversations({
        workspaceId,
        status: query.status,
        channel: query.channel,
        assignedTo: query.assignedTo,
        workItemId: query.workItemId,
        contactId: query.contactId,
        hasUnread: query.hasUnread,
        hasPendingApproval: query.hasPendingApproval,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        search: query.search,
        limit: query.limit
      });

      res.status(200).json(conversations);
    })
  );

  router.get(
    '/workspaces/:workspaceId/communication/conversations/:conversationId',
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const detail = await communicationConversationService.getConversationDetail(params);
      res.status(200).json(detail);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/read',
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const conversation = await communicationConversationService.markAsRead(params);
      res.status(200).json(conversation);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/resolve',
    requireConversationResolve,
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const conversation = await communicationConversationService.resolveConversation(params);
      res.status(200).json(conversation);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/archive',
    requireConversationArchive,
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const conversation = await communicationConversationService.archiveConversation(params);
      res.status(200).json(conversation);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/assign',
    requireConversationAssign,
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const body = assignCommunicationConversationDto.parse(req.body);
      const conversation = await communicationConversationService.assignConversation({
        ...params,
        assignedToId: body.assignedToId
      });
      res.status(200).json(conversation);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/link-work-item',
    requireConversationAssign,
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const body = linkCommunicationConversationWorkItemDto.parse(req.body);
      const conversation = await communicationConversationService.linkWorkItem({
        ...params,
        workItemId: body.workItemId
      });
      res.status(200).json(conversation);
    })
  );

  router.post(
    '/workspaces/:workspaceId/communication/conversations/:conversationId/reply',
    requireConversationReply,
    asyncHandler(async (req, res) => {
      const params = communicationConversationParamsDto.parse(req.params);
      const body = replyCommunicationConversationDto.parse(req.body);
      const reply = await communicationConversationService.replyManually({
        ...params,
        userId: req.auth!.userId,
        channel: body.channel,
        text: body.text,
        sendMode: body.sendMode
      });
      res.status(201).json(reply);
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-approvals',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listAutomationApprovalsQueryDto.parse(req.query);
      const approvals = await automationApprovalRequestService.listApprovals({
        workspaceId,
        status: query.status,
        type: query.type,
        channel: query.channel,
        workflowId: query.workflowId,
        contactId: query.contactId,
        workItemId: query.workItemId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        search: query.search,
        limit: query.limit
      });

      res.status(200).json({ items: approvals });
    })
  );

  router.get(
    '/workspaces/:workspaceId/automation-approvals/:approvalId',
    asyncHandler(async (req, res) => {
      const params = automationApprovalParamsDto.parse(req.params);
      const approval = await automationApprovalRequestService.getDetail(params);

      res.status(200).json(approval);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-approvals/:approvalId/approve',
    requireApprovalApprove,
    asyncHandler(async (req, res) => {
      const params = automationApprovalParamsDto.parse(req.params);
      const body = reviewAutomationApprovalDto.parse(req.body);
      const approval = await automationApprovalRequestService.approve({
        ...params,
        reviewedBy: req.auth!.userId,
        decision: body.decision,
        editedPayload: body.editedPayload,
        decisionReason: body.decisionReason
      });

      res.status(200).json(approval);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-approvals/:approvalId/reject',
    requireApprovalReject,
    asyncHandler(async (req, res) => {
      const params = automationApprovalParamsDto.parse(req.params);
      const body = reviewAutomationApprovalDto.parse(req.body);
      const approval = await automationApprovalRequestService.reject({
        ...params,
        reviewedBy: req.auth!.userId,
        decision: body.decision,
        decisionReason: body.decisionReason
      });

      res.status(200).json(approval);
    })
  );

  router.post(
    '/workspaces/:workspaceId/automation-approvals/:approvalId/cancel',
    requireApprovalCancel,
    asyncHandler(async (req, res) => {
      const params = automationApprovalParamsDto.parse(req.params);
      const body = cancelAutomationApprovalDto.parse(req.body);
      const approval = await automationApprovalRequestService.cancel({
        ...params,
        reason: body.reason
      });

      res.status(200).json(approval);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/runs',
    requireRunsRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listAutomationRunsQueryDto.parse(req.query);
      const runs = await deps.automationRunObservabilityService.listRuns({
        workspaceId,
        workflowId: query.workflowId,
        status: query.status,
        triggerType: query.triggerType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        search: query.search,
        limit: query.limit
      });

      res.status(200).json(runs);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/runs/:runId',
    requireRunsRead,
    asyncHandler(async (req, res) => {
      const params = automationRunParamsDto.parse(req.params);
      const detail = await deps.automationRunObservabilityService.getRunDetail(params);
      res.status(200).json(detail);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/runs/:runId/events',
    requireRunsRead,
    asyncHandler(async (req, res) => {
      const params = automationRunParamsDto.parse(req.params);
      const { limit } = listAutomationRunArtifactsQueryDto.parse(req.query);
      const events = await deps.automationRunObservabilityService.listEvents({ ...params, limit });
      res.status(200).json(events);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/runs/:runId/steps',
    requireRunsRead,
    asyncHandler(async (req, res) => {
      const params = automationRunParamsDto.parse(req.params);
      const steps = await deps.automationRunObservabilityService.listSteps(params);
      res.status(200).json(steps);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/runs/:runId/side-effects',
    requireRunsRead,
    asyncHandler(async (req, res) => {
      const params = automationRunParamsDto.parse(req.params);
      const { limit } = listAutomationRunArtifactsQueryDto.parse(req.query);
      const sideEffects = await deps.automationRunObservabilityService.listSideEffects({ ...params, limit });
      res.status(200).json(sideEffects);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/runs/:runId/cancel',
    requireRunsCancel,
    asyncHandler(async (req, res) => {
      const params = automationRunParamsDto.parse(req.params);
      const payload = cancelAutomationRunDto.parse(req.body);
      const run = await deps.automationRunService.cancelRun({
        workspaceId: params.workspaceId,
        runId: params.runId,
        reason: payload.reason
      });
      const detail = await deps.automationRunObservabilityService.getRunDetail({
        workspaceId: params.workspaceId,
        runId: run.id
      });

      res.status(200).json(detail);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/runs/:runId/retry-failed-step',
    requireRunsCancel,
    asyncHandler(async (req, res) => {
      automationRunParamsDto.parse(req.params);
      res.status(422).json({
        message: 'Manual retry is not enabled for automation runs yet.',
        safe: false
      });
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/communication/templates',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listCommunicationTemplatesQueryDto.parse(req.query);
      const templates = await deps.prisma.communicationTemplate.findMany({
        where: {
          workspaceId,
          channel: query.channel,
          status: query.status,
          archivedAt: null
        },
        include: {
          versions: {
            orderBy: [{ version: 'desc' }]
          }
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: Math.min(Math.max(query.limit ?? 100, 1), 500)
      });

      res.status(200).json({ items: templates });
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/communication/templates/whatsapp',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWhatsAppTemplateDto.parse(req.body);
      const template = await communicationTemplateService.createWhatsAppTemplate({
        workspaceId,
        name: payload.name,
        key: payload.key,
        body: payload.body,
        category: payload.category,
        language: payload.language,
        variables: payload.variables,
        components: payload.components,
        providerTemplateName: payload.providerTemplateName,
        createdById: req.auth!.userId
      });

      res.status(201).json(template);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/communication/templates/versions/:versionId',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = communicationTemplateVersionParamsDto.parse(req.params);
      const payload = updateCommunicationTemplateDraftVersionDto.parse(req.body);
      const version = await communicationTemplateService.updateDraftVersion({
        workspaceId: params.workspaceId,
        versionId: params.versionId,
        subject: payload.subject,
        textBody: payload.textBody,
        htmlBody: payload.htmlBody,
        variables: payload.variables,
        metadata: payload.metadata,
        components: payload.components,
        approvalStatus: payload.approvalStatus,
        providerTemplateName: payload.providerTemplateName,
        providerTemplateId: payload.providerTemplateId,
        language: payload.language
      });

      res.status(200).json(version);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/communication/templates/versions/:versionId/publish',
    requireWorkflowPublish,
    asyncHandler(async (req, res) => {
      const params = communicationTemplateVersionParamsDto.parse(req.params);
      const version = await communicationTemplateService.publishVersion({
        workspaceId: params.workspaceId,
        versionId: params.versionId,
        publishedById: req.auth!.userId
      });

      res.status(200).json(version);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/communication/templates/versions/:versionId/approval-status',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = communicationTemplateVersionParamsDto.parse(req.params);
      const payload = markWhatsAppTemplateApprovalStatusDto.parse(req.body);
      const version = await communicationTemplateService.markApprovalStatus({
        workspaceId: params.workspaceId,
        versionId: params.versionId,
        approvalStatus: payload.approvalStatus,
        providerTemplateName: payload.providerTemplateName,
        providerTemplateId: payload.providerTemplateId
      });

      res.status(200).json(version);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/communication/whatsapp/consents',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = listWhatsAppConsentsQueryDto.parse(req.query);
      const consents = await deps.prisma.contactConsent.findMany({
        where: {
          workspaceId,
          channel: 'whatsapp',
          status: query.status
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: Math.min(Math.max(query.limit ?? 100, 1), 500)
      });

      res.status(200).json({
        items: consents.map((consent) => ({
          ...consent,
          address: maskCommunicationAddress('whatsapp', consent.address)
        }))
      });
    })
  );

  router.put(
    '/automation/workspaces/:workspaceId/communication/whatsapp/consents',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = upsertWhatsAppConsentDto.parse(req.body);
      const consent = await communicationConsentService.upsertConsent({
        workspaceId,
        channel: 'whatsapp',
        address: payload.address,
        status: payload.status,
        source: payload.source ?? 'manual',
        reason: payload.reason,
        contactType: payload.contactType,
        contactId: payload.contactId
      });

      res.status(200).json({
        ...consent,
        address: maskCommunicationAddress('whatsapp', consent.address)
      });
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/side-effects/:sideEffectId/whatsapp-mock-events',
    requireWorkflowUpdate,
    asyncHandler(async (req, res) => {
      const params = automationSideEffectParamsDto.parse(req.params);
      const payload = simulateWhatsAppMockEventDto.parse(req.body);
      const sideEffect = await mockWhatsAppEventSimulator.simulate({
        workspaceId: params.workspaceId,
        sideEffectId: params.sideEffectId,
        eventType: payload.eventType,
        messageText: payload.messageText,
        metadata: payload.metadata
      });

      res.status(200).json(sideEffect);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/views',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const views = await deps.automationViewService.listViews({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(views);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/views',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createAutomationViewDto.parse(req.body);
      const view = await deps.automationViewService.createView({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(view);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/views/:viewId',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const payload = patchAutomationViewDto.parse(req.body);
      const view = await deps.automationViewService.updateView({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(view);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/views/:viewId/columns',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const columns = await deps.automationViewService.listViewColumns({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId
      });
      res.status(200).json(columns);
    })
  );

  router.post(
    '/automation/workspaces/:workspaceId/views/:viewId/columns',
    asyncHandler(async (req, res) => {
      const params = automationViewParamsDto.parse(req.params);
      const payload = createAutomationViewColumnDto.parse(req.body);
      const column = await deps.automationViewService.createViewColumn({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(column);
    })
  );

  router.patch(
    '/automation/workspaces/:workspaceId/views/:viewId/columns/:columnId',
    asyncHandler(async (req, res) => {
      const params = automationViewColumnParamsDto.parse(req.params);
      const payload = patchAutomationViewColumnDto.parse(req.body);
      const column = await deps.automationViewService.updateViewColumn({
        workspaceId: params.workspaceId,
        viewId: params.viewId,
        columnId: params.columnId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(column);
    })
  );

  router.get(
    '/automation/workspaces/:workspaceId/items/:itemId/placements',
    asyncHandler(async (req, res) => {
      const params = listItemPlacementsParamsDto.parse(req.params);
      const placements = await deps.automationViewService.listItemPlacements({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        userId: req.auth!.userId
      });

      res.status(200).json(placements);
    })
  );

  router.put(
    '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
    asyncHandler(async (req, res) => {
      const params = itemPlacementParamsDto.parse(req.params);
      const payload = upsertItemPlacementDto.parse(req.body);
      const placement = await deps.automationViewService.upsertItemPlacement({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        viewId: params.viewId,
        userId: req.auth!.userId,
        payload
      });

      res.status(200).json(placement);
    })
  );

  router.delete(
    '/automation/workspaces/:workspaceId/items/:itemId/placements/:viewId',
    asyncHandler(async (req, res) => {
      const params = itemPlacementParamsDto.parse(req.params);
      await deps.automationViewService.removeItemPlacement({
        workspaceId: params.workspaceId,
        itemId: params.itemId,
        viewId: params.viewId,
        userId: req.auth!.userId
      });

      res.status(204).send();
    })
  );

  return router;
};

