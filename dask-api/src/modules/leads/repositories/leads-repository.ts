import type {
  Lead,
  LeadActivity,
  LeadAssignment,
  LeadConversion,
  LeadDistributionStatus,
  LeadIntegrationEvent,
  LeadIntegrationEventStatus,
  LeadIntegrationSource,
  LeadNurtureTouch,
  LeadQualificationStatus,
  LeadStatus,
  Prisma
} from '@prisma/client';

export interface LeadsDashboard {
  captured: number;
  qualified: number;
  distributed: number;
  followUp: number;
  nurturing: number;
  converted: number;
  lost: number;
  conversionRate: number;
}

export interface LeadWithRelations extends Lead {
  activities: LeadActivity[];
  assignments: LeadAssignment[];
  nurtureTouches: LeadNurtureTouch[];
  conversion: LeadConversion | null;
}

export interface LeadsRepository {
  listLeads(input: {
    workspaceId: string;
    status?: LeadStatus;
    ownerUserId?: string;
    qualificationStatus?: LeadQualificationStatus;
    distributionStatus?: LeadDistributionStatus;
    search?: string;
    limit: number;
  }): Promise<Lead[]>;
  getDashboard(workspaceId: string): Promise<LeadsDashboard>;
  findLeadById(workspaceId: string, leadId: string): Promise<LeadWithRelations | null>;
  findLeadByExternal(input: {
    workspaceId: string;
    externalSource: LeadIntegrationSource;
    externalId: string;
  }): Promise<Lead | null>;
  createLead(data: Prisma.LeadUncheckedCreateInput): Promise<Lead>;
  updateLead(workspaceId: string, leadId: string, data: Prisma.LeadUncheckedUpdateInput): Promise<Lead>;
  createActivity(data: Prisma.LeadActivityUncheckedCreateInput): Promise<LeadActivity>;
  createAssignment(data: Prisma.LeadAssignmentUncheckedCreateInput): Promise<LeadAssignment>;
  createNurtureTouch(data: Prisma.LeadNurtureTouchUncheckedCreateInput): Promise<LeadNurtureTouch>;
  upsertConversion(data: Prisma.LeadConversionUncheckedCreateInput): Promise<LeadConversion>;
  findIntegrationEventByIdempotencyKey(idempotencyKey: string): Promise<LeadIntegrationEvent | null>;
  createIntegrationEvent(data: Prisma.LeadIntegrationEventUncheckedCreateInput): Promise<LeadIntegrationEvent>;
  updateIntegrationEvent(id: string, data: Prisma.LeadIntegrationEventUncheckedUpdateInput): Promise<LeadIntegrationEvent>;
  attachIntegrationEventToLead(id: string, leadId: string, workspaceId: string): Promise<LeadIntegrationEvent>;
  markIntegrationEventStatus(id: string, status: LeadIntegrationEventStatus, errorMessage?: string): Promise<LeadIntegrationEvent>;
}
