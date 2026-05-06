import { describe, expect, it } from 'vitest';
import { ConditionNodeExecutor } from '@/modules/automation/runtime/executors/condition-node-executor';
import type { AutomationNodeExecutionInput } from '@/modules/automation/runtime/automation-node-executor';

function makeInput(overrides: Partial<AutomationNodeExecutionInput> = {}): AutomationNodeExecutionInput {
  const node = overrides.node ?? {
    id: 'condition',
    type: 'condition',
    config: {
      field: 'proposal.status',
      operator: 'equals',
      value: 'sent'
    }
  };

  return {
    run: { id: 'run-1', triggerType: 'manual', triggerRefId: null } as any,
    stepRun: { id: 'step-1' } as any,
    node,
    graph: {
      version: 1,
      nodes: [node],
      edges: []
    },
    incomingEdges: [],
    outgoingEdges: [
      { id: 'true-edge', source: 'condition', target: 'true-node', sourceHandle: 'true' },
      { id: 'false-edge', source: 'condition', target: 'false-node', sourceHandle: 'false' }
    ],
    context: {
      proposal: {
        status: 'sent',
        approved: true
      }
    },
    input: {},
    now: new Date('2026-05-04T12:00:00.000Z'),
    ...overrides
  };
}

describe('ConditionNodeExecutor', () => {
  it('follows the true edge when the condition matches', async () => {
    const executor = new ConditionNodeExecutor();

    const result = await executor.execute(makeInput());

    expect(result).toMatchObject({
      status: 'completed',
      nextNodeIds: ['true-node'],
      output: {
        matched: true,
        selectedHandle: 'true'
      }
    });
  });

  it('follows the false edge when the condition does not match', async () => {
    const executor = new ConditionNodeExecutor();

    const result = await executor.execute(
      makeInput({
        context: {
          proposal: {
            status: 'draft'
          }
        }
      })
    );

    expect(result).toMatchObject({
      status: 'completed',
      nextNodeIds: ['false-node'],
      output: {
        matched: false,
        selectedHandle: 'false'
      }
    });
  });

  it('fails with invalid config', async () => {
    const executor = new ConditionNodeExecutor();

    const result = await executor.execute(
      makeInput({
        node: {
          id: 'condition',
          type: 'condition',
          config: {
            operator: 'equals',
            value: 'sent'
          }
        }
      })
    );

    expect(result).toMatchObject({
      status: 'failed',
      error: {
        nodeId: 'condition'
      }
    });
  });
});
