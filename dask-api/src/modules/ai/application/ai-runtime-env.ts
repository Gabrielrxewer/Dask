import { AppError } from '@/core/errors/app-error';

export type AiRuntimeEnvironment = 'development' | 'test' | 'production';

export interface AiProviderRuntimeEnv {
  nodeEnv: AiRuntimeEnvironment;
  openAiApiKey?: string | null;
}

export const AI_PROVIDER_PRODUCTION_ENV_VARS = ['OPENAI_API_KEY'] as const;

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function listMissingAiProviderProductionEnv(input: AiProviderRuntimeEnv): string[] {
  if (input.nodeEnv !== 'production') {
    return [];
  }

  return hasValue(input.openAiApiKey) ? [] : ['OPENAI_API_KEY'];
}

export function assertAiProviderProductionEnv(input: AiProviderRuntimeEnv): void {
  const missingEnv = listMissingAiProviderProductionEnv(input);
  if (missingEnv.length === 0) {
    return;
  }

  throw new AppError('AI provider environment is not configured for production', 503, {
    code: 'AI_PROVIDER_ENV_MISSING',
    missingEnv
  });
}
