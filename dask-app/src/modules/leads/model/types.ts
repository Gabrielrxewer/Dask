export type LeadStatus = "CAPTURED" | "QUALIFIED" | "DISTRIBUTED" | "FOLLOW_UP" | "NURTURING" | "CONVERTED" | "LOST";
export type LeadQualificationStatus = "UNQUALIFIED" | "MQL" | "SQL" | "DISQUALIFIED";
export type LeadDistributionStatus = "UNASSIGNED" | "ASSIGNED" | "ACCEPTED" | "REASSIGNED";
export type LeadDistributionStrategy = "MANUAL" | "ROUND_ROBIN" | "RULE_BASED" | "TERRITORY";
export type LeadSource = "MANUAL" | "API" | "WEBHOOK" | "IMPORT" | "INTEGRATION";
export type LeadConversionType = "CUSTOMER" | "OPPORTUNITY" | "DEAL" | "SUBSCRIPTION";

export interface Lead {
  id: string;
  workspaceId: string;
  status: LeadStatus;
  qualificationStatus: LeadQualificationStatus;
  distributionStatus: LeadDistributionStatus;
  captureSource: LeadSource;
  score: number;
  temperature: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  interest: string | null;
  ownerUserId: string | null;
  estimatedValue: string | null;
  currency: string;
  nextFollowUpAt: string | null;
  convertedAt: string | null;
  lostAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
}

export interface LeadAssignment {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  strategy: LeadDistributionStrategy;
  reason: string | null;
  createdAt: string;
}

export interface LeadNurtureTouch {
  id: string;
  status: string;
  channel: string;
  templateKey: string | null;
  subject: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface LeadConversion {
  id: string;
  conversionType: LeadConversionType;
  conversionRef: string;
  amount: string | null;
  currency: string;
  convertedAt: string;
}

export interface LeadDetails extends Lead {
  activities: LeadActivity[];
  assignments: LeadAssignment[];
  nurtureTouches: LeadNurtureTouch[];
  conversion: LeadConversion | null;
}

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

export interface CaptureLeadInput {
  source?: LeadSource;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  interest?: string;
  notes?: string;
  score?: number;
  estimatedValue?: string;
  tags?: string[];
}
