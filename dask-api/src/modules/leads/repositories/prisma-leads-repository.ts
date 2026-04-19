import {
  LeadDistributionStatus,
  LeadIntegrationEventStatus,
  LeadIntegrationSource,
  LeadQualificationStatus,
  LeadStatus,
  type Lead,
  type LeadActivity,
  type LeadAssignment,
  type LeadConversion,
  type LeadIntegrationEvent,
  type LeadNurtureTouch,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import type { LeadsDashboard, LeadsRepository, LeadWithRelations } from '@/modules/leads/repositories/leads-repository';

export class PrismaLeadsRepository implements LeadsRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listLeads(input: {
    workspaceId: string;
    status?: LeadStatus;
    ownerUserId?: string;
    qualificationStatus?: LeadQualificationStatus;
    distributionStatus?: LeadDistributionStatus;
    search?: string;
    limit: number;
  }): Promise<Lead[]> {
    const where: Prisma.LeadWhereInput = {
      workspaceId: input.workspaceId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.qualificationStatus ? { qualificationStatus: input.qualificationStatus } : {}),
      ...(input.distributionStatus ? { distributionStatus: input.distributionStatus } : {}),
      ...(input.search
        ? {
            OR: [
              { fullName: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
              { phone: { contains: input.search, mode: 'insensitive' } },
              { companyName: { contains: input.search, mode: 'insensitive' } },
              { interest: { contains: input.search, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    return this.prisma.lead.findMany({
      where,
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: input.limit
    });
  }

  public async getDashboard(workspaceId: string): Promise<LeadsDashboard> {
    const [captured, qualified, distributed, followUp, nurturing, converted, lost, total] = await Promise.all([
      this.prisma.lead.count({ where: { workspaceId, status: 'CAPTURED' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'QUALIFIED' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'DISTRIBUTED' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'FOLLOW_UP' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'NURTURING' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'CONVERTED' } }),
      this.prisma.lead.count({ where: { workspaceId, status: 'LOST' } }),
      this.prisma.lead.count({ where: { workspaceId } })
    ]);

    return {
      captured,
      qualified,
      distributed,
      followUp,
      nurturing,
      converted,
      lost,
      conversionRate: total > 0 ? Number((converted / total).toFixed(4)) : 0
    };
  }

  public async findLeadById(workspaceId: string, leadId: string): Promise<LeadWithRelations | null> {
    return this.prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId
      },
      include: {
        activities: {
          orderBy: {
            occurredAt: 'desc'
          },
          take: 200
        },
        assignments: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 200
        },
        nurtureTouches: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 200
        },
        conversion: true
      }
    });
  }

  public async findLeadByExternal(input: {
    workspaceId: string;
    externalSource: LeadIntegrationSource;
    externalId: string;
  }): Promise<Lead | null> {
    return this.prisma.lead.findUnique({
      where: {
        workspaceId_externalSource_externalId: {
          workspaceId: input.workspaceId,
          externalSource: input.externalSource,
          externalId: input.externalId
        }
      }
    });
  }

  public async createLead(data: Prisma.LeadUncheckedCreateInput): Promise<Lead> {
    return this.prisma.lead.create({ data });
  }

  public async updateLead(workspaceId: string, leadId: string, data: Prisma.LeadUncheckedUpdateInput): Promise<Lead> {
    const result = await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        workspaceId
      },
      data
    });

    if (result.count === 0) {
      throw new Error('Lead not found for update');
    }

    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId
      }
    });

    if (!lead) {
      throw new Error('Lead not found after update');
    }

    return lead;
  }

  public async createActivity(data: Prisma.LeadActivityUncheckedCreateInput): Promise<LeadActivity> {
    return this.prisma.leadActivity.create({ data });
  }

  public async createAssignment(data: Prisma.LeadAssignmentUncheckedCreateInput): Promise<LeadAssignment> {
    return this.prisma.leadAssignment.create({ data });
  }

  public async createNurtureTouch(data: Prisma.LeadNurtureTouchUncheckedCreateInput): Promise<LeadNurtureTouch> {
    return this.prisma.leadNurtureTouch.create({ data });
  }

  public async upsertConversion(data: Prisma.LeadConversionUncheckedCreateInput): Promise<LeadConversion> {
    return this.prisma.leadConversion.upsert({
      where: {
        leadId: data.leadId
      },
      create: data,
      update: {
        conversionType: data.conversionType,
        conversionRef: data.conversionRef,
        amount: data.amount,
        currency: data.currency,
        notes: data.notes,
        convertedByUserId: data.convertedByUserId,
        convertedAt: data.convertedAt,
        updatedAt: new Date()
      }
    });
  }

  public async findIntegrationEventByIdempotencyKey(idempotencyKey: string): Promise<LeadIntegrationEvent | null> {
    return this.prisma.leadIntegrationEvent.findUnique({
      where: {
        idempotencyKey
      }
    });
  }

  public async createIntegrationEvent(data: Prisma.LeadIntegrationEventUncheckedCreateInput): Promise<LeadIntegrationEvent> {
    return this.prisma.leadIntegrationEvent.create({ data });
  }

  public async updateIntegrationEvent(id: string, data: Prisma.LeadIntegrationEventUncheckedUpdateInput): Promise<LeadIntegrationEvent> {
    return this.prisma.leadIntegrationEvent.update({
      where: {
        id
      },
      data
    });
  }

  public async attachIntegrationEventToLead(id: string, leadId: string, workspaceId: string): Promise<LeadIntegrationEvent> {
    return this.prisma.leadIntegrationEvent.update({
      where: {
        id
      },
      data: {
        leadId,
        workspaceId
      }
    });
  }

  public async markIntegrationEventStatus(
    id: string,
    status: LeadIntegrationEventStatus,
    errorMessage?: string
  ): Promise<LeadIntegrationEvent> {
    return this.prisma.leadIntegrationEvent.update({
      where: {
        id
      },
      data: {
        status,
        lastError: errorMessage ?? null,
        processedAt: status === 'PROCESSED' || status === 'DUPLICATE' ? new Date() : null,
        attempts: {
          increment: 1
        }
      }
    });
  }
}
