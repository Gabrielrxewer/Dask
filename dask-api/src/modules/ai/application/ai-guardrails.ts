import { z } from 'zod';
import { redactSensitiveText as redactText } from '@/core/security/redaction';

export function redactSensitiveText(value: string): string {
  return redactText(value);
}

export function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

const riskSchema = z.object({
  summary: z.string().min(4),
  confidence: z.number().min(0).max(1),
  blockers: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(
    z.object({
      title: z.string().min(2),
      impact: z.enum(['low', 'medium', 'high', 'critical']),
      likelihood: z.enum(['low', 'medium', 'high']),
      mitigation: z.string().min(2)
    })
  ),
  nextActions: z.array(z.string()).min(1)
});

export type RiskAnalysisOutput = z.infer<typeof riskSchema>;

export function ensureRiskAnalysisOutput(value: string): RiskAnalysisOutput {
  const parsed = parseJsonObject(value);
  if (!parsed) {
    throw new Error('Risk analysis output must be a valid JSON object.');
  }
  return riskSchema.parse(parsed);
}

export function formatRiskAnalysisAsText(value: RiskAnalysisOutput): string {
  return [
    `Resumo: ${value.summary}`,
    `Confianca: ${(value.confidence * 100).toFixed(0)}%`,
    '',
    'Riscos:',
    ...value.risks.map(
      (risk, index) =>
        `${index + 1}. ${risk.title} | impacto=${risk.impact} | probabilidade=${risk.likelihood} | mitigacao=${risk.mitigation}`
    ),
    '',
    `Bloqueios: ${value.blockers.join('; ') || '-'}`,
    `Dependencias: ${value.dependencies.join('; ') || '-'}`,
    '',
    'Proximas acoes:',
    ...value.nextActions.map((action, index) => `${index + 1}. ${action}`)
  ].join('\n');
}
