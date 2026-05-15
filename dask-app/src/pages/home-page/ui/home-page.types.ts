import type { AppIconName } from "@/shared/ui";

export interface HomeBadge {
  label: string;
  tone?: "default" | "accent" | "warm";
}

export interface HomeMetric {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "accent" | "warm" | "success";
}

export interface HomePipelineStage {
  label: string;
  progress: number;
  isActive?: boolean;
  isDone?: boolean;
}

export interface HomeDeal {
  account: string;
  scope: string;
  amount: string;
  status: string;
  progress: number;
  tone?: "accent" | "success" | "warm";
}

export interface HomeActivity {
  label: string;
  time: string;
  icon: AppIconName;
}

export interface HomeProblem {
  icon: AppIconName;
  title: string;
  description: string;
}

export interface HomeRevenueStep {
  icon: AppIconName;
  title: string;
  description: string;
}

export interface HomeModule {
  icon: AppIconName;
  title: string;
  description: string;
}

export interface HomePlan {
  code: "BASIC" | "PRO" | "BUSINESS" | "ENTERPRISE";
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  isFeatured?: boolean;
  ctaLabel: string;
}

export interface HomeComparisonRow {
  commonCrm: string;
  dask: string;
}

export interface HomeInsightMetric {
  label: string;
  value: string;
  detail: string;
}

export interface HomeAudience {
  icon: AppIconName;
  title: string;
  description: string;
}

export interface HomeAutomationStep {
  title: string;
  description: string;
}

export interface HomeTrustItem {
  title: string;
  description: string;
}

export interface HomeAuditLog {
  time: string;
  event: string;
}
