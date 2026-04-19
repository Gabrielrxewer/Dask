import { apiClient } from "@/shared/api/http-client";
import type {
  CaptureLeadInput,
  Lead,
  LeadConversionType,
  LeadDetails,
  LeadDistributionStrategy,
  LeadDistributionStatus,
  LeadsDashboard,
  LeadQualificationStatus,
  LeadStatus
} from "@/modules/leads/model/types";

function asQueryString(input: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const encoded = query.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
}

export const leadsService = {
  getDashboard(workspaceId: string): Promise<LeadsDashboard> {
    return apiClient.get<LeadsDashboard>(`/leads/workspaces/${workspaceId}/dashboard`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  listLeads(
    workspaceId: string,
    input: {
      status?: LeadStatus;
      ownerUserId?: string;
      qualificationStatus?: LeadQualificationStatus;
      distributionStatus?: LeadDistributionStatus;
      search?: string;
      limit?: number;
    } = {}
  ): Promise<{ items: Lead[] }> {
    return apiClient.get<{ items: Lead[] }>(
      `/leads/workspaces/${workspaceId}/leads${asQueryString(input)}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  captureLead(workspaceId: string, input: CaptureLeadInput): Promise<Lead> {
    return apiClient.post<Lead>(`/leads/workspaces/${workspaceId}/leads`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  getLeadDetails(workspaceId: string, leadId: string): Promise<LeadDetails> {
    return apiClient.get<LeadDetails>(`/leads/workspaces/${workspaceId}/leads/${leadId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  qualifyLead(
    workspaceId: string,
    leadId: string,
    input: {
      qualificationStatus: LeadQualificationStatus;
      score?: number;
      temperature?: string;
      notes?: string;
    }
  ): Promise<Lead> {
    return apiClient.patch<Lead>(`/leads/workspaces/${workspaceId}/leads/${leadId}/qualify`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  distributeLead(
    workspaceId: string,
    leadId: string,
    input: { toUserId: string; strategy: LeadDistributionStrategy; reason?: string }
  ): Promise<Lead> {
    return apiClient.patch<Lead>(`/leads/workspaces/${workspaceId}/leads/${leadId}/distribute`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  registerFollowUp(
    workspaceId: string,
    leadId: string,
    input: { note?: string; nextFollowUpAt?: string }
  ): Promise<Lead> {
    return apiClient.post<Lead>(`/leads/workspaces/${workspaceId}/leads/${leadId}/follow-ups`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  registerNurture(
    workspaceId: string,
    leadId: string,
    input: {
      channel: string;
      templateKey?: string;
      subject?: string;
      message?: string;
      scheduledAt?: string;
    }
  ): Promise<{ lead: Lead }> {
    return apiClient.post<{ lead: Lead }>(`/leads/workspaces/${workspaceId}/leads/${leadId}/nurture`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  convertLead(
    workspaceId: string,
    leadId: string,
    input: {
      conversionType: LeadConversionType;
      conversionRef: string;
      amount?: string;
      currency?: string;
      notes?: string;
    }
  ): Promise<Lead> {
    return apiClient.post<Lead>(`/leads/workspaces/${workspaceId}/leads/${leadId}/convert`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  markLost(workspaceId: string, leadId: string, reason?: string): Promise<Lead> {
    return apiClient.post<Lead>(`/leads/workspaces/${workspaceId}/leads/${leadId}/lost`, { reason }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  }
};
