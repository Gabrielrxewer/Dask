import { z } from 'zod';

export const workspaceIdParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const automationRunParamsDto = z.object({
  workspaceId: z.string().uuid(),
  runId: z.string().uuid()
});

export const automationWorkflowParamsDto = z.object({
  workspaceId: z.string().uuid(),
  workflowId: z.string().uuid()
});

export const automationWorkflowVersionParamsDto = z.object({
  workspaceId: z.string().uuid(),
  workflowId: z.string().uuid(),
  versionId: z.string().uuid()
});

export const listAutomationWorkflowsQueryDto = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const createAutomationWorkflowDto = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused']).optional()
});

export const patchAutomationWorkflowDto = z
  .object({
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().nullable().optional(),
    status: z.enum(['draft', 'active', 'paused', 'archived']).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const listAutomationWorkflowVersionsQueryDto = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const automationWorkflowGraphNodeDto = z.object({
  id: z.string().trim().default(''),
  type: z.string().trim().default(''),
  label: z.string().trim().optional(),
  config: z.record(z.unknown()).default({}),
  position: z
    .object({
      x: z.number(),
      y: z.number()
    })
    .optional()
});

const automationWorkflowGraphEdgeDto = z.object({
  id: z.string().trim().default(''),
  source: z.string().trim().default(''),
  target: z.string().trim().default(''),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  condition: z.record(z.unknown()).optional()
});

const automationWorkflowGraphDto = z.object({
  version: z.literal(1),
  nodes: z.array(automationWorkflowGraphNodeDto),
  edges: z.array(automationWorkflowGraphEdgeDto),
  metadata: z.record(z.unknown()).optional()
});

export const createAutomationWorkflowDraftVersionDto = z.object({
  definition: z.record(z.unknown()).optional(),
  graph: automationWorkflowGraphDto.optional(),
  graphNodes: z.array(automationWorkflowGraphNodeDto).optional(),
  graphEdges: z.array(automationWorkflowGraphEdgeDto).optional()
});

export const updateAutomationWorkflowVersionDto = z
  .object({
    definition: z.record(z.unknown()).optional(),
    graph: automationWorkflowGraphDto.optional(),
    graphNodes: z.array(automationWorkflowGraphNodeDto).optional(),
    graphEdges: z.array(automationWorkflowGraphEdgeDto).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const publishAutomationWorkflowVersionDto = z.object({
  activateWorkflow: z.boolean().optional()
});

export const runAutomationWorkflowDto = z.object({
  triggerType: z.literal('manual').default('manual'),
  context: z.record(z.unknown()).default({})
});

export const installNativeAutomationWorkflowsDto = z.object({
  nativeKeys: z.array(z.string().trim().min(1)).min(1).optional(),
  activate: z.boolean().optional()
});

export const listAutomationRunArtifactsQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const listCommunicationTemplatesQueryDto = z.object({
  channel: z.string().trim().toLowerCase().optional(),
  status: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const createWhatsAppTemplateDto = z.object({
  name: z.string().trim().min(2),
  key: z.string().trim().min(2),
  body: z.string().trim().min(1),
  category: z.string().trim().min(1).default('utility'),
  language: z.string().trim().min(2).default('pt_BR'),
  variables: z.array(z.string().trim().min(1)).optional(),
  components: z.unknown().optional(),
  providerTemplateName: z.string().trim().min(1).optional()
});

export const communicationTemplateVersionParamsDto = z.object({
  workspaceId: z.string().uuid(),
  versionId: z.string().uuid()
});

export const updateCommunicationTemplateDraftVersionDto = z
  .object({
    subject: z.string().nullable().optional(),
    textBody: z.string().nullable().optional(),
    htmlBody: z.string().nullable().optional(),
    variables: z.array(z.string().trim().min(1)).optional(),
    metadata: z.unknown().optional(),
    components: z.unknown().optional(),
    approvalStatus: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'paused', 'disabled']).optional(),
    providerTemplateName: z.string().trim().min(1).nullable().optional(),
    providerTemplateId: z.string().trim().min(1).nullable().optional(),
    language: z.string().trim().min(2).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const markWhatsAppTemplateApprovalStatusDto = z.object({
  approvalStatus: z.enum(['pending_review', 'approved', 'rejected', 'paused', 'disabled']),
  providerTemplateName: z.string().trim().min(1).nullable().optional(),
  providerTemplateId: z.string().trim().min(1).nullable().optional()
});

export const listWhatsAppConsentsQueryDto = z.object({
  status: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const upsertWhatsAppConsentDto = z.object({
  address: z.string().trim().min(1),
  status: z.enum(['unknown', 'opted_in', 'opted_out', 'suppressed', 'bounced', 'complained', 'invalid']),
  source: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional(),
  contactType: z.string().trim().min(1).nullable().optional(),
  contactId: z.string().trim().min(1).nullable().optional()
});

export const automationSideEffectParamsDto = z.object({
  workspaceId: z.string().uuid(),
  sideEffectId: z.string().uuid()
});

export const automationApprovalParamsDto = z.object({
  workspaceId: z.string().uuid(),
  approvalId: z.string().uuid()
});

export const listAutomationApprovalsQueryDto = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'cancelled']).optional(),
  type: z.enum(['send_message', 'move_card', 'create_task', 'apply_ai_recommendation']).optional(),
  channel: z.string().trim().toLowerCase().min(1).optional(),
  workflowId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  workItemId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const reviewAutomationApprovalDto = z.object({
  decision: z.record(z.unknown()).optional(),
  editedPayload: z.record(z.unknown()).optional(),
  decisionReason: z.string().trim().max(500).optional()
});

export const cancelAutomationApprovalDto = z.object({
  reason: z.string().trim().max(500).optional()
});

export const simulateWhatsAppMockEventDto = z.object({
  eventType: z.enum(['delivered', 'read', 'failed', 'replied']),
  messageText: z.string().trim().max(1000).optional(),
  metadata: z.unknown().optional()
});

export const communicationConversationParamsDto = z.object({
  workspaceId: z.string().uuid(),
  conversationId: z.string().uuid()
});

export const listCommunicationInboxQueryDto = z.object({
  status: z.enum(['open', 'pending', 'waiting_customer', 'waiting_internal', 'resolved', 'archived', 'blocked']).optional(),
  channel: z.enum(['email', 'whatsapp']).optional(),
  assignedTo: z.string().uuid().optional(),
  workItemId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  hasUnread: z.coerce.boolean().optional(),
  hasPendingApproval: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const assignCommunicationConversationDto = z.object({
  assignedToId: z.string().uuid().nullable().optional()
});

export const linkCommunicationConversationWorkItemDto = z.object({
  workItemId: z.string().uuid().nullable().optional()
});

export const replyCommunicationConversationDto = z.object({
  channel: z.enum(['email', 'whatsapp']),
  text: z.string().trim().min(1).max(4000),
  sendMode: z.literal('manual').default('manual')
});

export const listAutomationRunsQueryDto = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.string().optional(),
  triggerType: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const cancelAutomationRunDto = z.object({
  reason: z.string().trim().max(280).optional()
});

export const automationViewParamsDto = z.object({
  workspaceId: z.string().uuid(),
  viewId: z.string().uuid()
});

export const automationViewColumnParamsDto = z.object({
  workspaceId: z.string().uuid(),
  viewId: z.string().uuid(),
  columnId: z.string().uuid()
});

const automationViewColumnPayloadDto = z.object({
  key: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  settings: z.record(z.unknown()).optional()
});

export const createAutomationViewDto = z.object({
  key: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
  columns: z.array(automationViewColumnPayloadDto).optional()
});

export const patchAutomationViewDto = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    position: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    settings: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const createAutomationViewColumnDto = automationViewColumnPayloadDto;

export const patchAutomationViewColumnDto = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    color: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    settings: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const itemPlacementParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  viewId: z.string().uuid()
});

export const listItemPlacementsParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid()
});

export const upsertItemPlacementDto = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional()
});
