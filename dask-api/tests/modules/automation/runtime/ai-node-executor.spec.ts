import { describe, expect, it, vi } from 'vitest';
import { AINodeExecutor } from '@/modules/automation/runtime/executors/ai-node-executor';
import { HumanApprovalNodeExecutor } from '@/modules/automation/runtime/executors/human-approval-node-executor';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makeInput(type: string, config: Record<string, unknown>, previousOutput?: Record<string, unknown>) {
  return {
    run: {
      id: 'run-1',
      workspaceId: 'ws-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-1',
      triggerType: 'manual',
      triggerRefId: null,
      status: 'running',
      contextJson: {},
      startedAt: baseDate,
      finishedAt: null,
      cancelledAt: null,
      cancelReason: null,
      errorJson: null,
      createdAt: baseDate,
      updatedAt: baseDate
    },
    stepRun: {
      id: 'step-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      nodeId: 'node-1',
      nodeType: type,
      status: 'running',
      inputJson: {},
      outputJson: null,
      errorJson: null,
      attempt: 1,
      idempotencyKey: null,
      startedAt: baseDate,
      finishedAt: null,
      createdAt: baseDate,
      updatedAt: baseDate
    },
    node: { id: 'node-1', type, config },
    graph: { version: 1 as const, nodes: [], edges: [] },
    incomingEdges: [],
    outgoingEdges: [],
    context: {},
    input: { previousOutput },
    now: baseDate
  };
}

describe('AI automation node executors', () => {
  it('classifies an inbound reply and emits timeline events', async () => {
    const aiService = {
      classifyReply: vi.fn().mockResolvedValue({
        intent: 'question',
        sentiment: 'interested',
        urgency: 'medium',
        needsHuman: true,
        suggestedCategory: 'commercial_question',
        confidence: 0.82,
        reason: 'Cliente pediu prazo.'
      })
    };
    const eventService = { createEvent: vi.fn() };
    const executor = new AINodeExecutor('ai_classify_reply', aiService as any, eventService as any);

    const result = await executor.execute(makeInput('ai_classify_reply', {
      messageText: 'Tenho interesse, mas preciso entender melhor o prazo.',
      channel: 'whatsapp',
      contactId: 'contact-1'
    }) as any);

    expect(result).toMatchObject({
      status: 'completed',
      output: {
        aiNodeType: 'ai_classify_reply',
        intent: 'question',
        needsHuman: true,
        confidence: 0.82
      }
    });
    expect(aiService.classifyReply).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1',
      channel: 'whatsapp'
    }));
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ai.node_started' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ai.reply_classified' })
    );
  });

  it('generates a draft that always requires approval', async () => {
    const aiService = {
      generateMessageDraft: vi.fn().mockResolvedValue({
        draftText: 'Ola {{contact.name}}, posso te explicar o prazo.',
        channel: 'whatsapp',
        requiresApproval: true,
        unsafeToAutoSend: true,
        reason: 'Resposta comercial personalizada precisa de revisao humana.'
      })
    };
    const executor = new AINodeExecutor('ai_generate_message_draft', aiService as any, { createEvent: vi.fn() } as any);

    const result = await executor.execute(makeInput('ai_generate_message_draft', {
      channel: 'whatsapp',
      goal: 'answer_deadline_question',
      contextSummary: 'Cliente perguntou prazo.'
    }) as any);

    expect(result).toMatchObject({
      status: 'completed',
      output: {
        requiresApproval: true,
        unsafeToAutoSend: true,
        draftText: expect.stringContaining('prazo')
      }
    });
  });

  it('fills template variables without inventing missing values', async () => {
    const aiService = {
      fillTemplateVariables: vi.fn().mockReturnValue({
        variables: { 'contact.name': 'Gabriel' },
        missingVariables: ['proposal.code'],
        safeToUseTemplate: false
      })
    };
    const executor = new AINodeExecutor('ai_fill_template_variables', aiService as any, { createEvent: vi.fn() } as any);

    const result = await executor.execute(makeInput('ai_fill_template_variables', {
      context: { contact: { name: 'Gabriel' } },
      requiredVariables: ['contact.name', 'proposal.code']
    }) as any);

    expect(result).toMatchObject({
      status: 'completed',
      output: {
        safeToUseTemplate: false,
        missingVariables: ['proposal.code']
      }
    });
  });

  it('creates human approval and returns waiting status', async () => {
    const approvalRequestService = {
      createApprovalRequest: vi.fn().mockResolvedValue({
        id: 'approval-1',
        status: 'pending',
        type: 'send_message'
      })
    };
    const executor = new HumanApprovalNodeExecutor(approvalRequestService as any);

    const result = await executor.execute(makeInput('human_approval', {
      type: 'send_message',
      title: 'Aprovar resposta',
      payloadFromNode: 'ai_generate_message_draft'
    }, {
      draftText: 'Ola',
      requiresApproval: true
    }) as any);

    expect(result).toMatchObject({
      status: 'waiting',
      reason: 'waiting_for_human_approval',
      output: {
        approvalRequestId: 'approval-1',
        approvalStatus: 'pending'
      }
    });
    expect(approvalRequestService.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        type: 'send_message'
      })
    );
  });
});
