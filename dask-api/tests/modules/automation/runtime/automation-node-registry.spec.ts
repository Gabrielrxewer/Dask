import { describe, expect, it, vi } from 'vitest';
import {
  AutomationNodeRegistry,
  createDefaultAutomationNodeRegistry
} from '@/modules/automation/runtime/automation-node-registry';
import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

describe('AutomationNodeRegistry', () => {
  it('registers and returns an executor by type', () => {
    const execute = vi.fn(async () => ({ status: 'completed' as const }));
    const executor: AutomationNodeExecutor = {
      type: 'custom',
      execute
    };
    const registry = new AutomationNodeRegistry();

    registry.register(executor);
    const resolved = registry.get('custom');

    expect(resolved).toBe(executor);
    expect(registry.has('custom')).toBe(true);
  });

  it('fails clearly when an executor type is not registered', () => {
    const registry = new AutomationNodeRegistry();

    expect(() => registry.get('send_email')).toThrow(
      'Automation node executor not registered for type "send_email".'
    );
  });

  it('builds the default internal node registry', async () => {
    const registry = createDefaultAutomationNodeRegistry();

    expect(registry.listTypes()).toEqual(['condition', 'delay', 'end', 'noop', 'trigger']);
    await expect(
      registry.get('noop').execute({
        node: { id: 'noop', type: 'noop', config: {} },
        now: new Date('2026-05-04T12:00:00.000Z')
      } as AutomationNodeExecutionInput)
    ).resolves.toMatchObject({
      status: 'completed'
    });
  });
});
