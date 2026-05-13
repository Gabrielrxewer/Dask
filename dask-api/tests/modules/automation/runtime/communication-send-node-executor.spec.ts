import { describe, expect, it, vi } from 'vitest';
import { CommunicationSendNodeExecutor } from '@/modules/automation/runtime/executors/communication-send-node-executor';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makeInput(config: Record<string, unknown>) {
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
      nodeId: 'send-1',
      nodeType: 'communication_send',
      status: 'running',
      inputJson: {},
      outputJson: null,
      errorJson: null,
      attempt: 1,
      idempotencyKey: 'step-key',
      startedAt: baseDate,
      finishedAt: null,
      createdAt: baseDate,
      updatedAt: baseDate
    },
    node: {
      id: 'send-1',
      type: 'communication_send',
      config
    },
    graph: { version: 1, nodes: [], edges: [] },
    incomingEdges: [],
    outgoingEdges: [],
    context: {
      contact: {
        email: 'person@example.com',
        name: 'Maria'
      },
      event: {
        payload: {
          itemId: 'item-1',
          workItemId: 'item-1'
        }
      }
    },
    input: {},
    now: baseDate
  };
}

describe('CommunicationSendNodeExecutor', () => {
  it('creates a side effect and does not call a provider directly', async () => {
    const sideEffectService = {
      createSideEffect: vi.fn(async () => ({
        id: 'side-effect-1',
        status: 'queued',
        sideEffectType: 'communication.email',
        channel: 'email',
        provider: 'mock',
        idempotencyKey: 'run-1:step-1:send-1:communication.email'
      }))
    };
    const executor = new CommunicationSendNodeExecutor(sideEffectService as any);

    const result = await executor.execute(makeInput({
      channel: 'email',
      provider: 'mock',
      to: '{{contact.email}}',
      from: 'Dask <noreply@example.com>',
      replyTo: 'support@example.com',
      subject: 'Olá {{contact.name}}',
      text: 'Passando para acompanhar {{contact.name}}.',
      html: '<p>Passando para acompanhar {{contact.name}}.</p>'
    }) as any);

    expect(sideEffectService.createSideEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        runId: 'run-1',
        stepRunId: 'step-1',
        sideEffectType: 'communication.email',
        channel: 'email',
        provider: 'mock',
        payload: expect.objectContaining({
          to: 'person@example.com',
          from: 'Dask <noreply@example.com>',
          replyTo: 'support@example.com',
          subject: 'Olá Maria',
          body: 'Passando para acompanhar Maria.',
          text: 'Passando para acompanhar Maria.',
          html: '<p>Passando para acompanhar Maria.</p>'
        })
      })
    );
    expect(result).toMatchObject({
      status: 'completed',
      output: {
        sideEffectId: 'side-effect-1',
        sideEffectStatus: 'queued'
      }
    });
  });

  it('reuses a stable idempotency key when configured', async () => {
    const sideEffectService = {
      createSideEffect: vi.fn(async () => ({
        id: 'side-effect-1',
        status: 'queued',
        sideEffectType: 'communication.whatsapp',
        channel: 'whatsapp',
        provider: 'mock',
        idempotencyKey: 'custom-person@example.com'
      }))
    };
    const executor = new CommunicationSendNodeExecutor(sideEffectService as any);

    await executor.execute(makeInput({
      channel: 'whatsapp',
      to: '+5511999999999',
      body: 'Oi',
      idempotencyKey: 'custom-{{contact.email}}'
    }) as any);

    expect(sideEffectService.createSideEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'custom-person@example.com'
      })
    );
  });

  it('renders WorkItem metadata for operational CRM communications', async () => {
    const sideEffectService = {
      createSideEffect: vi.fn(async () => ({
        id: 'side-effect-1',
        status: 'queued',
        sideEffectType: 'communication.email',
        channel: 'email',
        provider: 'mock',
        idempotencyKey: 'run-1:step-1:send-1:communication.email'
      }))
    };
    const executor = new CommunicationSendNodeExecutor(sideEffectService as any);

    await executor.execute(makeInput({
      channel: 'email',
      to: '{{contact.email}}',
      body: 'Oi',
      metadata: {
        itemId: '{{event.payload.itemId}}',
        workItemId: '{{event.payload.workItemId}}',
        nativeDomain: 'commercial'
      }
    }) as any);

    expect(sideEffectService.createSideEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            itemId: 'item-1',
            workItemId: 'item-1',
            nativeDomain: 'commercial'
          })
        })
      })
    );
  });
});
