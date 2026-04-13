export interface HomeBadge {
  label: string;
  tone?: "default" | "success" | "warning";
}

export interface HomeSignal {
  label: string;
  value: string;
  description: string;
}

export interface HomeFeature {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
}

export interface HomePreviewLane {
  title: string;
  description: string;
  count: string;
  tone: "violet" | "blue" | "teal";
  items: string[];
}

export interface HomeFocusMetric {
  label: string;
  value: string;
}

export interface HomeFocusPanel {
  eyebrow: string;
  title: string;
  summary: string;
  status: string;
  tags: string[];
  metrics: HomeFocusMetric[];
  insights: string[];
}

export interface HomeSearchLens {
  label: string;
  query: string;
  context: string;
  results: string[];
}

export interface HomeStructureLayer {
  label: string;
  title: string;
  description: string;
}

export interface HomeProcessStage {
  step: string;
  title: string;
  description: string;
  note: string;
}

export interface HomeUseCase {
  title: string;
  description: string;
  outcome: string;
}
