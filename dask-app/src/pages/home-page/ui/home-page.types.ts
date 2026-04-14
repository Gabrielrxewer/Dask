export interface HomeBadge {
  label: string;
  tone?: "default" | "success" | "warning";
}

export interface HomeSignal {
  label: string;
  value: string;
  description: string;
}

export interface HomeValuePillar {
  eyebrow: string;
  title: string;
  description: string;
}

export interface HomeProcessStage {
  step: string;
  title: string;
  description: string;
}

export interface HomeUseCase {
  title: string;
  focus: string;
}

export interface HomeArchitectureItem {
  label: string;
  detail: string;
}
