import { apiClient } from '@/shared/api/http-client';
import type {
  CreateMarketingCampaignInput,
  MarketingAudienceContact,
  MarketingAutomationFlow,
  MarketingCampaignAnalytics,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingDashboard,
  MarketingSegment,
  MarketingTemplate
} from '@/modules/marketing/model/types';

function asQueryString(input: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return;
    }

    query.set(key, String(value));
  });

  const encoded = query.toString();
  return encoded.length > 0 ? `?${encoded}` : '';
}

export const marketingService = {
  getDashboard(workspaceId: string): Promise<MarketingDashboard> {
    return apiClient.get<MarketingDashboard>(`/marketing/workspaces/${workspaceId}/dashboard`, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  listCampaigns(
    workspaceId: string,
    input: {
      status?: string;
      objective?: string;
      search?: string;
      limit?: number;
    } = {}
  ): Promise<{ items: MarketingCampaignListItem[] }> {
    return apiClient.get<{ items: MarketingCampaignListItem[] }>(
      `/marketing/workspaces/${workspaceId}/campaigns${asQueryString(input)}`,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  createCampaign(workspaceId: string, input: CreateMarketingCampaignInput): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(`/marketing/workspaces/${workspaceId}/campaigns`, input, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  getCampaignDetails(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails> {
    return apiClient.get<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}`,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  updateCampaign(workspaceId: string, campaignId: string, patch: Record<string, unknown>): Promise<MarketingCampaignDetails> {
    return apiClient.patch<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}`,
      patch,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  submitForReview(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/submit-review`,
      undefined,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  approveCampaign(workspaceId: string, campaignId: string): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/approve`,
      undefined,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  scheduleCampaign(workspaceId: string, campaignId: string, scheduledAt: string): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/schedule`,
      { scheduledAt },
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  sendTestEmail(
    workspaceId: string,
    campaignId: string,
    input: { to: string; subject?: string; content?: string }
  ): Promise<{ providerKey: string; providerMessageId: string }> {
    return apiClient.post<{ providerKey: string; providerMessageId: string }>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/send-test`,
      input,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  launchCampaign(
    workspaceId: string,
    campaignId: string,
    options?: { dryRun?: boolean }
  ): Promise<{
    queued: number;
    skipped: number;
    skippedWithoutConsent: number;
    skippedWithoutEmail: number;
    leadsEvaluated: number;
  }> {
    const query = options?.dryRun ? '?dryRun=true' : '';
    return apiClient.post<{
      queued: number;
      skipped: number;
      skippedWithoutConsent: number;
      skippedWithoutEmail: number;
      leadsEvaluated: number;
    }>(`/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/launch${query}`, undefined, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  getAnalytics(workspaceId: string, campaignId: string): Promise<MarketingCampaignAnalytics> {
    return apiClient.get<MarketingCampaignAnalytics>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/analytics`,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  listAudienceContacts(
    workspaceId: string,
    input: {
      search?: string;
      stage?: string;
      consentStatus?: string;
      limit?: number;
    } = {}
  ): Promise<{ items: MarketingAudienceContact[] }> {
    return apiClient.get<{ items: MarketingAudienceContact[] }>(
      `/marketing/workspaces/${workspaceId}/audience/contacts${asQueryString(input)}`,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  listSegments(workspaceId: string): Promise<{ items: MarketingSegment[] }> {
    return apiClient.get<{ items: MarketingSegment[] }>(`/marketing/workspaces/${workspaceId}/audience/segments`, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  createSegment(
    workspaceId: string,
    input: {
      name: string;
      description?: string;
      kind?: 'STATIC' | 'DYNAMIC';
      filters: MarketingSegment['filters'];
    }
  ): Promise<MarketingSegment> {
    return apiClient.post<MarketingSegment>(`/marketing/workspaces/${workspaceId}/audience/segments`, input, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  updateSegment(
    workspaceId: string,
    segmentId: string,
    patch: {
      name?: string;
      description?: string;
      kind?: 'STATIC' | 'DYNAMIC';
      filters?: MarketingSegment['filters'];
      isActive?: boolean;
    }
  ): Promise<MarketingSegment> {
    return apiClient.patch<MarketingSegment>(
      `/marketing/workspaces/${workspaceId}/audience/segments/${segmentId}`,
      patch,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  previewSegment(workspaceId: string, segmentId: string, limit?: number): Promise<{
    segment: MarketingSegment;
    estimatedContacts: number;
    sample: MarketingAudienceContact['lead'][];
  }> {
    const query = typeof limit === 'number' ? `?limit=${limit}` : '';
    return apiClient.post<{
      segment: MarketingSegment;
      estimatedContacts: number;
      sample: MarketingAudienceContact['lead'][];
    }>(`/marketing/workspaces/${workspaceId}/audience/segments/${segmentId}/preview${query}`, undefined, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  listTemplates(workspaceId: string): Promise<{ items: MarketingTemplate[] }> {
    return apiClient.get<{ items: MarketingTemplate[] }>(`/marketing/workspaces/${workspaceId}/templates`, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  createTemplate(
    workspaceId: string,
    input: {
      name: string;
      slug?: string;
      category?: string;
      objective?: string;
      funnelStage?: string;
      subject: string;
      bodyMarkdown: string;
      bodyHtml?: string;
      blocks?: Record<string, unknown>;
    }
  ): Promise<MarketingTemplate> {
    return apiClient.post<MarketingTemplate>(`/marketing/workspaces/${workspaceId}/templates`, input, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  updateTemplate(workspaceId: string, templateId: string, patch: Record<string, unknown>): Promise<MarketingTemplate> {
    return apiClient.patch<MarketingTemplate>(`/marketing/workspaces/${workspaceId}/templates/${templateId}`, patch, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  listAutomationFlows(workspaceId: string): Promise<{ items: MarketingAutomationFlow[] }> {
    return apiClient.get<{ items: MarketingAutomationFlow[] }>(
      `/marketing/workspaces/${workspaceId}/automations/flows`,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  createAutomationFlow(workspaceId: string, input: Record<string, unknown>): Promise<MarketingAutomationFlow> {
    return apiClient.post<MarketingAutomationFlow>(`/marketing/workspaces/${workspaceId}/automations/flows`, input, {
      authMode: 'required',
      retryOnUnauthorized: true
    });
  },

  aiGenerateCampaign(
    workspaceId: string,
    input: {
      objective: string;
      tone?: string;
      targetStage?: string;
      segmentHint?: string;
      documentLimit?: number;
    }
  ): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/ai/generate-campaign`,
      input,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  },

  aiImproveVariant(
    workspaceId: string,
    campaignId: string,
    variantId: string,
    input: {
      objective?: string;
      tone?: string;
    }
  ): Promise<MarketingCampaignDetails> {
    return apiClient.post<MarketingCampaignDetails>(
      `/marketing/workspaces/${workspaceId}/campaigns/${campaignId}/variants/${variantId}/ai-improve`,
      input,
      {
        authMode: 'required',
        retryOnUnauthorized: true
      }
    );
  }
};
