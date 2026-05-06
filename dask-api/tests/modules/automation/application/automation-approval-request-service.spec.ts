import { describe, expect, it, vi } from 'vitest';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makePrisma() {
  const approvals: any[] = [];
  const sideEffects: any[] = [];
  const events = { createEvent: vi.fn() };
  const prisma = {
    automationApprovalRequest: {
      create: vi.fn(async ({ data }) => {
        const approval = {
          id: `approval-${approvals.length + 1}`,
          decisionJson: null,
          reviewedBy: null,
          reviewedAt: null,
          requestedAt: baseDate,
          createdAt: baseDate,
          updatedAt: baseDate,
          ...data
        };
        approvals.push(approval);
        return approval;
      }),
      findMany: vi.fn(async ({ where }) =>
        approvals.filter((entry) =>
          (!where.workspaceId || entry.workspaceId === where.workspaceId)
          && (!where.runId || entry.runId === where.runId)
          && (!where.status || entry.status === where.status)
        )
      ),
      findFirst: vi.fn(async ({ where }) =>
        approvals.find((entry) =>
          (!where.id || entry.id === where.id)
          && (!where.workspaceId || entry.workspaceId === where.workspaceId)
        ) ?? null
      ),
      update: vi.fn(async ({ where, data }) => {
        const approval = approvals.find((entry) => entry.id === where.id);
        Object.assign(approval, data, { updatedAt: baseDate });
        return approval;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let count = 0;
        for (const approval of approvals) {
          if (where.workspaceId && approval.workspaceId !== where.workspaceId) {
            continue;
          }
          if (where.runId && approval.runId !== where.runId) {
            continue;
          }
          if (where.status && approval.status !== where.status) {
            continue;
          }
          Object.assign(approval, data, { updatedAt: baseDate });
          count += 1;
        }
        return { count };
      })
    },
    automationSideEffect: {
      findUnique: vi.fn(async ({ where }) =>
        sideEffects.find((entry) =>
          entry.workspaceId === where.workspaceId_idempotencyKey.workspaceId
          && entry.idempotencyKey === where.workspaceId_idempotencyKey.idempotencyKey
        ) ?? null
      ),
      create: vi.fn(async ({ data }) => {
        const sideEffect = {
          id: `side-effect-${sideEffects.length + 1}`,
          createdAt: baseDate,
          updatedAt: baseDate,
          ...data
        };
        sideEffects.push(sideEffect);
        return sideEffect;
      })
    },
    automationStepRun: {
      updateMany: vi.fn(async () => ({ count: 1 }))
    },
    automationRun: {
      updateMany: vi.fn(async () => ({ count: 1 }))
    },
    automationScheduledStep: {
      updateMany: vi.fn(async () => ({ count: 0 }))
    }
  };
  const service = new AutomationApprovalRequestService(prisma as any, {
    eventService: events as any
  });
  return { service, approvals, events, sideEffects, prisma };
}

describe('AutomationApprovalRequestService', () => {
  it('creates and lists pending approval requests', async () => {
    const { service, events } = makePrisma();

    const approval = await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      type: 'send_message',
      title: 'Aprovar resposta',
      payload: { draftText: 'Ola', token: 'secret' }
    });
    const pending = await service.listPending({ workspaceId: 'ws-1' });

    expect(approval).toMatchObject({ status: 'pending', type: 'send_message' });
    expect(pending).toHaveLength(1);
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'approval.requested' })
    );
  });

  it('approves and rejects pending requests with timeline events', async () => {
    const { service, events } = makePrisma();
    const first = await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      type: 'send_message',
      title: 'Aprovar resposta'
    });
    const second = await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-2',
      type: 'create_task',
      title: 'Criar tarefa'
    });

    await service.approve({
      workspaceId: 'ws-1',
      approvalId: first.id,
      reviewedBy: 'user-1',
      decision: { ok: true }
    });
    await service.reject({
      workspaceId: 'ws-1',
      approvalId: second.id,
      reviewedBy: 'user-1',
      decision: { reason: 'needs changes' }
    });

    expect(await service.getById({ workspaceId: 'ws-1', approvalId: first.id })).toMatchObject({
      status: 'approved',
      reviewedBy: 'user-1'
    });
    expect(await service.getById({ workspaceId: 'ws-1', approvalId: second.id })).toMatchObject({
      status: 'rejected'
    });
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'approval.approved' })
    );
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'approval.rejected' })
    );
  });

  it('creates an approved message side effect once and never creates one for rejection', async () => {
    const { service, sideEffects } = makePrisma();
    const sendApproval = await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      type: 'send_message',
      title: 'Aprovar resposta',
      contactId: 'contact-1',
      payload: { channel: 'whatsapp', draftText: 'Ola, posso ajudar.' }
    });
    const taskApproval = await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-2',
      type: 'create_task',
      title: 'Criar tarefa'
    });

    await service.approve({
      workspaceId: 'ws-1',
      approvalId: sendApproval.id,
      reviewedBy: 'user-1',
      editedPayload: { text: 'Texto revisado.' }
    });
    await expect(service.approve({
      workspaceId: 'ws-1',
      approvalId: sendApproval.id,
      reviewedBy: 'user-1'
    })).rejects.toThrow('Only pending automation approval requests can be reviewed.');
    await service.reject({
      workspaceId: 'ws-1',
      approvalId: taskApproval.id,
      reviewedBy: 'user-1',
      decisionReason: 'Nao aplicar agora.'
    });

    expect(sideEffects).toHaveLength(1);
    expect(sideEffects[0]).toMatchObject({
      approvalRequestId: sendApproval.id,
      contactId: 'contact-1',
      sideEffectType: 'communication.whatsapp',
      status: 'queued',
      idempotencyKey: `approval:${sendApproval.id}:send_message`
    });
  });

  it('cancels pending approvals for a run', async () => {
    const { service, events } = makePrisma();
    await service.createApprovalRequest({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      type: 'send_message',
      title: 'Aprovar resposta'
    });

    const result = await service.cancelRunApprovals({
      workspaceId: 'ws-1',
      runId: 'run-1',
      reason: 'run cancelled'
    });

    expect(result.count).toBe(1);
    expect(await service.listPending({ workspaceId: 'ws-1' })).toHaveLength(0);
    expect(events.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'approval.cancelled' })
    );
  });
});
