import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AutomationBusinessActionService } from '@/modules/automation/application/automation-business-action-service';
import type { AutomationNodeExecutionInput } from '@/modules/automation/runtime/automation-node-executor';
import {
  BusinessActionNodeExecutor,
  businessActionNodeTypes
} from '@/modules/automation/runtime/executors/business-action-node-executors';

function buildInput(node: AutomationNodeExecutionInput['node']): AutomationNodeExecutionInput {
  return {
    run: {
      id: 'run-1',
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      triggerType: 'item.moved',
      triggerRefId: 'event-1'
    } as AutomationNodeExecutionInput['run'],
    stepRun: { id: 'step-1' } as AutomationNodeExecutionInput['stepRun'],
    node,
    graph: { version: 1, nodes: [node], edges: [], metadata: {} },
    incomingEdges: [],
    outgoingEdges: [],
    context: {
      requestedBy: 'user-1',
      event: {
        payload: {
          itemId: 'item-1',
          email: 'buyer@example.com'
        }
      },
      item: {
        title: 'Conta ACME'
      }
    },
    input: {},
    now: new Date('2026-05-09T12:00:00.000Z')
  };
}

function buildExecutor(type: (typeof businessActionNodeTypes)[number], service: AutomationBusinessActionService): BusinessActionNodeExecutor {
  return new BusinessActionNodeExecutor(type, {} as PrismaClient, service);
}

describe('BusinessActionNodeExecutor', () => {
  it('exposes only official executable CRM business node types', () => {
    expect(businessActionNodeTypes).toEqual([
      'move_work_item',
      'update_work_item_fields',
      'create_proposal',
      'create_contract',
      'send_document',
      'update_document_status',
      'ensure_customer_from_work_item',
      'create_billing_order',
      'create_followup_task',
      'register_card_activity'
    ]);
    expect(businessActionNodeTypes).not.toContain('create_document');
  });

  it.each([
    [
      'move_work_item',
      'moveWorkItem',
      {
        itemIdPath: 'event.payload.itemId',
        columnSlug: 'proposal_sent'
      },
      expect.objectContaining({ workspaceId: 'workspace-1', userId: 'user-1', itemId: 'item-1', columnSlug: 'proposal_sent' })
    ],
    [
      'update_work_item_fields',
      'updateWorkItemFields',
      {
        itemIdPath: 'event.payload.itemId',
        title: '{{item.title}} atualizado',
        customFieldValues: { probability: '80' }
      },
      expect.objectContaining({ title: 'Conta ACME atualizado', customFieldValues: { probability: '80' } })
    ],
    [
      'create_proposal',
      'createProposal',
      {
        itemIdPath: 'event.payload.itemId',
        templateKey: 'commercial_proposal',
        targetFieldSlug: 'proposalId'
      },
      expect.objectContaining({ itemId: 'item-1', templateKey: 'commercial_proposal', targetFieldSlug: 'proposalId' })
    ],
    [
      'create_contract',
      'createContract',
      {
        itemIdPath: 'event.payload.itemId',
        templateKey: 'commercial_contract',
        proposalFieldSlug: 'proposalId',
        targetFieldSlug: 'contractId'
      },
      expect.objectContaining({ itemId: 'item-1', proposalFieldSlug: 'proposalId', targetFieldSlug: 'contractId' })
    ],
    [
      'send_document',
      'sendDocument',
      {
        itemIdPath: 'event.payload.itemId',
        documentFieldSlug: 'proposalId',
        kind: 'proposal',
        emailPath: 'event.payload.email'
      },
      expect.objectContaining({ itemId: 'item-1', documentFieldSlug: 'proposalId', kind: 'proposal', email: 'buyer@example.com' })
    ],
    [
      'update_document_status',
      'updateDocumentStatus',
      {
        itemIdPath: 'event.payload.itemId',
        documentFieldSlug: 'proposalId',
        kind: 'proposal',
        status: 'approved'
      },
      expect.objectContaining({ itemId: 'item-1', documentFieldSlug: 'proposalId', kind: 'proposal', status: 'approved' })
    ],
    [
      'ensure_customer_from_work_item',
      'ensureCustomerFromWorkItem',
      {
        itemIdPath: 'event.payload.itemId',
        targetFieldSlug: 'customerId',
        status: 'active'
      },
      expect.objectContaining({ itemId: 'item-1', targetFieldSlug: 'customerId', status: 'active' })
    ],
    [
      'create_billing_order',
      'createBillingOrder',
      {
        itemIdPath: 'event.payload.itemId',
        targetFieldSlug: 'billingOrderId',
        customerIdFieldSlug: 'customerId',
        amountCents: 120000
      },
      expect.objectContaining({ itemId: 'item-1', targetFieldSlug: 'billingOrderId', customerIdFieldSlug: 'customerId', amountCents: 120000 })
    ],
    [
      'create_followup_task',
      'createFollowupTask',
      {
        itemIdPath: 'event.payload.itemId',
        title: 'Follow-up {{item.title}}',
        description: 'Retomar contato',
        assigneeIdPath: 'requestedBy',
        dueInDays: 2
      },
      expect.objectContaining({ sourceItemId: 'item-1', title: 'Follow-up Conta ACME', assigneeId: 'user-1' })
    ],
    [
      'register_card_activity',
      'registerCardActivity',
      {
        itemIdPath: 'event.payload.itemId',
        eventName: 'automation.note',
        message: 'Proposta criada',
        severity: 'success'
      },
      expect.objectContaining({
        workspaceId: 'workspace-1',
        itemId: 'item-1',
        eventName: 'automation.note',
        payload: expect.objectContaining({ message: 'Proposta criada', severity: 'success' })
      })
    ]
  ])('calls the real business action service for %s', async (nodeType, methodName, config, expectedInput) => {
    const service = {
      moveWorkItem: vi.fn(async () => ({ resourceType: 'work_item', resourceId: 'resource-1' })),
      updateWorkItemFields: vi.fn(async () => ({ resourceType: 'work_item', resourceId: 'resource-1' })),
      createProposal: vi.fn(async () => ({ resourceType: 'document', resourceId: 'proposal-1' })),
      createContract: vi.fn(async () => ({ resourceType: 'document', resourceId: 'contract-1' })),
      sendDocument: vi.fn(async () => ({ resourceType: 'document', resourceId: 'proposal-1' })),
      updateDocumentStatus: vi.fn(async () => ({ resourceType: 'document', resourceId: 'proposal-1' })),
      ensureCustomerFromWorkItem: vi.fn(async () => ({ resourceType: 'customer', resourceId: 'customer-1' })),
      createBillingOrder: vi.fn(async () => ({ resourceType: 'billing_order', resourceId: 'billing-1' })),
      createFollowupTask: vi.fn(async () => ({ resourceType: 'work_item', resourceId: 'followup-1' })),
      registerCardActivity: vi.fn(async () => ({ resourceType: 'item_history', resourceId: 'history-1' }))
    } as unknown as AutomationBusinessActionService;
    const executor = buildExecutor(nodeType, service);

    const result = await executor.execute(buildInput({
      id: `node-${nodeType}`,
      type: nodeType,
      config
    }));

    expect(result).toMatchObject({ status: 'completed' });
    expect(service[methodName as keyof AutomationBusinessActionService]).toHaveBeenCalledWith(expectedInput);
  });
});
