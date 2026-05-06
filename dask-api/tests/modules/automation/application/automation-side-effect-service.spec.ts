import { describe, expect, it, vi } from 'vitest';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makePrisma() {
  const sideEffects: any[] = [];
  const events = {
    createEvent: vi.fn()
  };
  const delegate = {
    create: vi.fn(async ({ data }) => {
      const sideEffect = {
        id: `side-effect-${sideEffects.length + 1}`,
        attempts: 0,
        resultJson: null,
        errorJson: null,
        lockedAt: null,
        lockedBy: null,
        cancelledAt: null,
        cancelReason: null,
        processedAt: null,
        createdAt: baseDate,
        updatedAt: baseDate,
        ...data
      };
      sideEffects.push(sideEffect);
      return sideEffect;
    }),
    findUnique: vi.fn(async ({ where }) => {
      if (where.id) {
        return sideEffects.find((entry) => entry.id === where.id) ?? null;
      }
      if (where.workspaceId_idempotencyKey) {
        return sideEffects.find((entry) =>
          entry.workspaceId === where.workspaceId_idempotencyKey.workspaceId
          && entry.idempotencyKey === where.workspaceId_idempotencyKey.idempotencyKey
        ) ?? null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where }) =>
      sideEffects.find((entry) =>
        (!where.id || entry.id === where.id)
        && (!where.workspaceId || entry.workspaceId === where.workspaceId)
      ) ?? null
    ),
    findMany: vi.fn(async ({ where }) =>
      sideEffects.filter((entry) => {
        if (where.workspaceId && entry.workspaceId !== where.workspaceId) {
          return false;
        }
        if (where.runId && entry.runId !== where.runId) {
          return false;
        }
        if (where.status === 'queued' && entry.status !== 'queued') {
          return false;
        }
        if (where.status?.in && !where.status.in.includes(entry.status)) {
          return false;
        }
        return true;
      })
    ),
    update: vi.fn(async ({ where, data }) => {
      const entry = sideEffects.find((candidate) => candidate.id === where.id);
      Object.assign(entry, data, { updatedAt: baseDate });
      return entry;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      let count = 0;
      for (const entry of sideEffects) {
        if (where.id && entry.id !== where.id) {
          continue;
        }
        if (where.workspaceId && entry.workspaceId !== where.workspaceId) {
          continue;
        }
        if (where.runId && entry.runId !== where.runId) {
          continue;
        }
        if (where.status === 'queued' && entry.status !== 'queued') {
          continue;
        }
        if (where.status?.in && !where.status.in.includes(entry.status)) {
          continue;
        }
        if (where.lockedAt === null && entry.lockedAt !== null) {
          continue;
        }
        if (data.attempts?.increment) {
          entry.attempts += data.attempts.increment;
        }
        const { attempts: _attempts, ...rest } = data;
        Object.assign(entry, rest, { updatedAt: baseDate });
        count += 1;
      }
      return { count };
    })
  };
  const prisma = {
    automationApprovalRequest: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.id === 'approval-approved') {
          return {
            id: 'approval-approved',
            workspaceId: where.workspaceId,
            runId: 'run-1',
            stepRunId: 'step-1',
            type: 'send_message',
            status: 'approved',
            title: 'Approved',
            description: null,
            payloadJson: {},
            decisionJson: {},
            requestedBy: 'automation-runtime',
            reviewedBy: 'user-1',
            requestedAt: baseDate,
            reviewedAt: baseDate,
            expiresAt: null,
            createdAt: baseDate,
            updatedAt: baseDate,
            contactId: null,
            workItemId: null
          };
        }
        return null;
      })
    },
    automationSideEffect: delegate,
    automationRun: {
      findFirst: vi.fn(async () => ({ id: 'run-1', status: 'running' }))
    },
    automationStepRun: {
      findFirst: vi.fn(async () => ({ id: 'step-1' }))
    },
    $transaction: vi.fn(async (callback) => callback(prisma))
  };
  const service = new AutomationSideEffectService(prisma as any, {
    eventService: events as any,
    retryPolicy: { maxAttempts: 2, backoffMs: 1000, backoffMultiplier: 1 }
  });

  return { service, sideEffects, events, delegate };
}

describe('AutomationSideEffectService', () => {
  it('creates a queued side effect and logs the timeline event', async () => {
    const { service, events } = makePrisma();

    const sideEffect = await service.createSideEffect({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.email',
      channel: 'email',
      provider: 'mock',
      idempotencyKey: 'run-1:step-1:email',
      payload: { to: 'person@example.com', body: 'Hello', token: 'secret' }
    });

    expect(sideEffect).toMatchObject({
      status: 'queued',
      idempotencyKey: 'run-1:step-1:email'
    });
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'side_effect.created' })
    );
  });

  it('requires an idempotency key', async () => {
    const { service } = makePrisma();

    await expect(service.createSideEffect({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.email',
      channel: 'email',
      provider: 'mock',
      idempotencyKey: '',
      payload: {}
    })).rejects.toThrow('idempotencyKey is required');
  });

  it('returns the existing side effect for the same workspace idempotency key', async () => {
    const { service, delegate } = makePrisma();
    const input = {
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.email',
      channel: 'email',
      provider: 'mock',
      idempotencyKey: 'same-key',
      payload: { to: 'person@example.com', body: 'Hello' }
    };

    const first = await service.createSideEffect(input);
    const second = await service.createSideEffect(input);

    expect(second.id).toBe(first.id);
    expect(delegate.create).toHaveBeenCalledTimes(1);
  });

  it('creates WhatsApp side effects with contact, channel and template metadata without duplicating idempotency keys', async () => {
    const { service, delegate } = makePrisma();
    const input = {
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      provider: 'mock',
      idempotencyKey: 'run-1:step-1:whatsapp:contact-1',
      templateVersionId: 'template-version-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1',
      payload: {
        channel: 'whatsapp',
        provider: 'mock',
        to: '+5549999999999',
        templateKey: 'proposal_followup_whatsapp_1',
        templateVersionId: 'template-version-1',
        variables: {
          'proposal.code': 'PROP-123'
        }
      }
    };

    const first = await service.createSideEffect(input);
    const second = await service.createSideEffect(input);

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      provider: 'mock',
      templateVersionId: 'template-version-1',
      contactId: 'contact-1',
      contactChannelId: 'channel-1'
    });
    expect(delegate.create).toHaveBeenCalledTimes(1);
  });

  it('moves through processing, sent, failed and cancelled statuses with events', async () => {
    const { service, events } = makePrisma();
    const sideEffect = await service.createSideEffect({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.email',
      channel: 'email',
      provider: 'mock',
      idempotencyKey: 'status-key',
      payload: { to: 'person@example.com', body: 'Hello' }
    });

    const [locked] = await service.lockNextPending({ lockedBy: 'worker-1', now: baseDate, limit: 1 });
    expect(locked).toMatchObject({ id: sideEffect.id, status: 'processing', attempts: 1 });

    await service.markSent({ workspaceId: 'ws-1', sideEffectId: sideEffect.id, result: { ok: true } });
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'side_effect.sent' })
    );

    await service.markFailed({ workspaceId: 'ws-1', sideEffectId: sideEffect.id, error: { message: 'bad' } });
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'side_effect.failed' })
    );

    await service.cancelSideEffect({ workspaceId: 'ws-1', sideEffectId: sideEffect.id, reason: 'test' });
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'side_effect.cancelled' })
    );
  });

  it('blocks AI generated communication side effects without human approval', async () => {
    const { service, events } = makePrisma();

    await expect(service.createSideEffect({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      provider: 'mock',
      idempotencyKey: 'ai-whatsapp-no-approval',
      payload: {
        to: '+5549999999999',
        body: 'AI draft',
        metadata: {
          aiGenerated: true,
          unsafeToAutoSend: true
        }
      }
    })).rejects.toThrow('Human approval is required');

    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'communication.blocked_missing_human_approval' })
    );
  });

  it('allows AI generated communication side effects with approved human approval', async () => {
    const { service } = makePrisma();

    const sideEffect = await service.createSideEffect({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      sideEffectType: 'communication.whatsapp',
      channel: 'whatsapp',
      provider: 'mock',
      idempotencyKey: 'ai-whatsapp-approved',
      approvalRequestId: 'approval-approved',
      payload: {
        to: '+5549999999999',
        body: 'AI draft',
        metadata: {
          aiGenerated: true,
          unsafeToAutoSend: true,
          approvalRequestId: 'approval-approved'
        }
      }
    });

    expect(sideEffect).toMatchObject({
      status: 'queued',
      approvalRequestId: 'approval-approved'
    });
  });
});
