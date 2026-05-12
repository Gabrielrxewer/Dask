import { describe, expect, it } from 'vitest';
import { compileMarketingJourneyRuntime } from '@/modules/marketing/application/marketing-runtime-compiler';

function buildSimpleJourneyDefinition(): Record<string, unknown> {
  return {
    version: 1,
    trigger: { event: 'commercial_work_item.created' },
    nodes: [
      {
        id: 'trigger-1',
        type: 'TRIGGER',
        data: {
          kind: 'TRIGGER',
          label: 'WorkItem created',
          config: { event: 'commercial_work_item.created' },
        },
      },
      {
        id: 'send-welcome',
        type: 'ACTION',
        data: {
          kind: 'ACTION',
          label: 'Send welcome',
          config: { type: 'send_campaign', campaignId: 'campaign-1' },
        },
      },
      {
        id: 'end',
        type: 'EXIT',
        data: {
          kind: 'EXIT',
          label: 'End',
          config: {},
        },
      },
    ],
    edges: [
      { id: 'edge-trigger-send', source: 'trigger-1', target: 'send-welcome' },
      { id: 'edge-send-end', source: 'send-welcome', target: 'end' },
    ],
    metadata: {
      compiledAt: '2026-05-10T11:00:00.000Z',
      sourceHash: 'journey-hash-1',
    },
  };
}

describe('compileMarketingJourneyRuntime', () => {
  it('compiles a valid simple marketing journey into an executable runtime graph', () => {
    const compiled = compileMarketingJourneyRuntime({
      flowId: 'flow-1',
      name: 'Welcome flow',
      status: 'DRAFT',
      triggerDefinition: buildSimpleJourneyDefinition(),
    });

    expect(compiled).not.toBeNull();
    if (!compiled) {
      throw new Error('Expected marketing journey runtime to compile.');
    }

    expect(compiled.definition).toEqual(expect.objectContaining({
      schemaVersion: 1,
      definitionType: 'automation_workflow',
      source: expect.objectContaining({
        kind: 'marketing_journey',
        flowId: 'flow-1',
        compiledAt: '2026-05-10T11:00:00.000Z',
        compilerVersion: 1,
        sourceVersion: 1,
        sourceHash: 'journey-hash-1',
      }),
      trigger: expect.objectContaining({
        event: 'commercial_work_item.created',
        config: expect.objectContaining({ domainEvent: 'commercial_work_item.created' }),
      }),
      settings: expect.objectContaining({
        name: 'Welcome flow',
        status: 'draft',
      }),
      executionPlan: {
        schemaVersion: 1,
        entryNodeIds: ['trigger-1'],
        terminalNodeIds: ['end'],
        parallelGroups: [],
      },
    }));

    expect(compiled.graph).toEqual(expect.objectContaining({
      version: 1,
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: 'trigger-1', type: 'trigger' }),
        expect.objectContaining({
          id: 'send-welcome',
          type: 'communication_send',
          config: expect.objectContaining({
            channel: 'email',
            templateKey: 'campaign-1',
          }),
        }),
        expect.objectContaining({ id: 'end', type: 'end' }),
      ]),
      edges: expect.arrayContaining([
        expect.objectContaining({ id: 'edge-trigger-send', source: 'trigger-1', target: 'send-welcome' }),
        expect.objectContaining({ id: 'edge-send-end', source: 'send-welcome', target: 'end' }),
      ]),
      metadata: expect.objectContaining({
        source: 'marketing_journey',
        compilerVersion: 1,
        graphVersion: 1,
        flowId: 'flow-1',
        triggerCount: 1,
        actionCount: 1,
        approvalCount: 0,
        branchCount: 0,
        terminalCount: 1,
      }),
    }));
  });

  it('compiles a marketing journey branch into runtime edge conditions', () => {
    const compiled = compileMarketingJourneyRuntime({
      flowId: 'flow-branch',
      triggerDefinition: {
        version: 1,
        trigger: { event: 'commercial_work_item.score_updated' },
        nodes: [
          { id: 'trigger-1', type: 'TRIGGER', data: { kind: 'TRIGGER', config: { event: 'commercial_work_item.score_updated' } } },
          {
            id: 'score-branch',
            type: 'CONDITION',
            data: {
              kind: 'CONDITION',
              config: {
                logic: 'all',
                rules: [{ field: 'contact.score', operator: 'greater_than', value: 80 }],
              },
            },
          },
          { id: 'send-vip', type: 'ACTION', data: { kind: 'ACTION', config: { type: 'send_campaign', campaignId: 'vip-campaign' } } },
          { id: 'end-low-score', type: 'EXIT', data: { kind: 'EXIT', config: {} } },
          { id: 'end-vip', type: 'EXIT', data: { kind: 'EXIT', config: {} } },
        ],
        edges: [
          { id: 'edge-trigger-branch', source: 'trigger-1', target: 'score-branch' },
          { id: 'edge-branch-yes', source: 'score-branch', target: 'send-vip', data: { branchType: 'yes' } },
          { id: 'edge-branch-no', source: 'score-branch', target: 'end-low-score', data: { branchType: 'no' } },
          { id: 'edge-send-end', source: 'send-vip', target: 'end-vip' },
        ],
        metadata: { compiledAt: '2026-05-10T11:00:00.000Z' },
      },
    });

    expect(compiled).not.toBeNull();
    if (!compiled) {
      throw new Error('Expected branch journey runtime to compile.');
    }

    expect(compiled.graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'score-branch',
        type: 'condition',
        config: expect.objectContaining({
          logic: 'all',
          rules: [{ field: 'contact.score', operator: 'greater_than', value: 80 }],
        }),
      }),
    ]));
    expect(compiled.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'edge-branch-yes', condition: { branchType: 'yes' } }),
      expect.objectContaining({ id: 'edge-branch-no', condition: { branchType: 'no' } }),
    ]));
    expect(compiled.graph.metadata).toEqual(expect.objectContaining({
      branchCount: 1,
      actionCount: 1,
      terminalCount: 2,
    }));
  });

  it('rejects a marketing journey without a trigger before runtime activation', () => {
    expect(() =>
      compileMarketingJourneyRuntime({
        flowId: 'flow-invalid',
        triggerDefinition: {
          version: 1,
          nodes: [
            { id: 'send-welcome', type: 'ACTION', data: { kind: 'ACTION', config: { type: 'send_campaign', campaignId: 'campaign-1' } } },
          ],
          edges: [],
          metadata: {},
        },
      })
    ).toThrowError(/trigger node/);
  });

  it('rejects a marketing journey with a broken edge', () => {
    expect(() =>
      compileMarketingJourneyRuntime({
        flowId: 'flow-invalid',
        triggerDefinition: {
          version: 1,
          nodes: [
            { id: 'trigger-1', type: 'TRIGGER', data: { kind: 'TRIGGER', config: { event: 'commercial_work_item.created' } } },
            { id: 'end', type: 'EXIT', data: { kind: 'EXIT', config: {} } },
          ],
          edges: [{ id: 'edge-broken', source: 'trigger-1', target: 'missing-node' }],
          metadata: {},
        },
      })
    ).toThrowError(/missing target node/);
  });

  it('rejects a marketing journey action without required configuration', () => {
    expect(() =>
      compileMarketingJourneyRuntime({
        flowId: 'flow-invalid',
        triggerDefinition: {
          version: 1,
          nodes: [
            { id: 'trigger-1', type: 'TRIGGER', data: { kind: 'TRIGGER', config: { event: 'commercial_work_item.created' } } },
            { id: 'send-welcome', type: 'ACTION', data: { kind: 'ACTION', config: { type: 'send_campaign' } } },
            { id: 'end', type: 'EXIT', data: { kind: 'EXIT', config: {} } },
          ],
          edges: [
            { id: 'edge-trigger-send', source: 'trigger-1', target: 'send-welcome' },
            { id: 'edge-send-end', source: 'send-welcome', target: 'end' },
          ],
          metadata: {},
        },
      })
    ).toThrowError(/campaignId/);
  });

  it('accepts a persisted runtimeGraph only when it matches the marketing journey source', () => {
    const sourceDefinition = buildSimpleJourneyDefinition();
    const firstCompile = compileMarketingJourneyRuntime({
      flowId: 'flow-1',
      triggerDefinition: sourceDefinition,
    });

    expect(firstCompile).not.toBeNull();
    if (!firstCompile) {
      throw new Error('Expected marketing journey runtime to compile.');
    }

    const compiled = compileMarketingJourneyRuntime({
      flowId: 'flow-1',
      triggerDefinition: {
        ...sourceDefinition,
        metadata: {
          compiledAt: '2026-05-10T11:00:00.000Z',
          sourceHash: 'journey-hash-1',
          runtimeGraph: firstCompile.graph,
        },
      },
    });

    expect(compiled).not.toBeNull();
    expect(compiled?.graph.nodes).toEqual(firstCompile.graph.nodes);
    expect(compiled?.graph.edges).toEqual(firstCompile.graph.edges);
    expect(compiled?.graph.metadata).toEqual(expect.objectContaining({
      source: 'marketing_journey',
      compilerVersion: 1,
      graphVersion: 1,
      flowId: 'flow-1',
    }));
  });

  it('returns null when no journey source or runtime graph has been compiled yet', () => {
    expect(compileMarketingJourneyRuntime({
      flowId: 'flow-1',
      triggerDefinition: {
        status: 'DRAFT',
        trigger: { eventName: 'commercial_work_item.created' },
        metadata: {},
      },
    })).toBeNull();
  });

  it('rejects invalid persisted runtime graphs before they can be executed', () => {
    expect(() =>
      compileMarketingJourneyRuntime({
        flowId: 'flow-1',
        triggerDefinition: {
          metadata: {
            runtimeGraph: {
              version: 2,
              nodes: [],
              edges: [],
            },
          },
        },
      })
    ).toThrowError(/at least one node|version/);
  });
});
