import { describe, expect, it } from 'vitest';
import { PromptOrchestrationService } from '@/modules/ai/application/prompt-orchestration-service';

describe('PromptOrchestrationService', () => {
  it('builds a deterministic prompt for description improvement', () => {
    const service = new PromptOrchestrationService();

    const prompt = service.buildDescriptionImprovementPrompt({
      title: 'Fix login flow',
      description: 'User cannot recover password'
    });

    expect(prompt).toContain('Fix login flow');
    expect(prompt).toContain('User cannot recover password');
    expect(prompt).toContain('improves task card descriptions');
  });
});
