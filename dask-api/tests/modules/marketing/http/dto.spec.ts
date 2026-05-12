import { describe, expect, it } from 'vitest';
import { createSignalFollowUpDto } from '@/modules/marketing/http/dto';

describe('marketing/http dto', () => {
  it('requires workItemId for signal follow-up payloads and does not accept legacy leadId', () => {
    const workItemId = '11111111-1111-4111-8111-111111111111';

    expect(createSignalFollowUpDto.parse({
      workItemId,
      title: 'Retornar contato'
    })).toMatchObject({
      workItemId,
      title: 'Retornar contato',
      priority: 'medium',
      createWorkItem: false
    });

    expect(() => createSignalFollowUpDto.parse({
      leadId: workItemId,
      title: 'Retornar contato'
    })).toThrow();
  });
});
