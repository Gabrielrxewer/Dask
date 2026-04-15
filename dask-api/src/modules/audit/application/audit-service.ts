import type { Prisma} from '@prisma/client';
import { AuditSeverity, type PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@/core/events/domain-event';

export class AuditService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async recordEvent(event: DomainEvent): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        eventName: event.name,
        severity: AuditSeverity.INFO,
        actorId: this.extractActorId(event),
        workspaceId: this.extractWorkspaceId(event),
        metadata: event.payload as Prisma.InputJsonValue
      }
    });
  }

  public listLatest(limit = 50) {
    return this.prisma.auditEvent.findMany({
      orderBy: { happenedAt: 'desc' },
      take: limit
    });
  }

  public listLatestByWorkspace(workspaceId: string, limit = 50) {
    return this.prisma.auditEvent.findMany({
      where: { workspaceId },
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
