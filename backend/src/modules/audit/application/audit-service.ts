import { AuditSeverity, type PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';
import type { EventBus } from '@/core/events/event-bus';

export class AuditService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly eventBus: EventBus
  ) {}

  public registerEventListeners(): void {
    this.eventBus.subscribe('*', async (event) => {
      await this.recordEvent(event);
    });
  }

  public async recordEvent(event: DomainEvent): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        eventName: event.name,
        severity: AuditSeverity.INFO,
        actorId: this.extractActorId(event),
        workspaceId: this.extractWorkspaceId(event),
        metadata: event.payload
      }
    });
  }

  public listLatest(limit = 50) {
    return this.prisma.auditEvent.findMany({
      orderBy: { happenedAt: 'desc' },
      take: limit
    });
  }

  private extractActorId(event: DomainEvent): string | null {
    const payload = event.payload as Record<string, unknown>;
    const maybe = payload.requestedBy;
    return typeof maybe === 'string' ? maybe : null;
  }

  private extractWorkspaceId(event: DomainEvent): string | null {
    const payload = event.payload as Record<string, unknown>;
    const maybe = payload.workspaceId;
    return typeof maybe === 'string' ? maybe : null;
  }
}
