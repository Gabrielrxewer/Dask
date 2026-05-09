import { describe, expect, it } from 'vitest';
import {
  buildCanonicalAutomationWorkflowGraph,
  validateAutomationWorkflowGraph
} from '@/modules/automation/application/automation-workflow-graph-validation';

const validGraph = {
  version: 1,
  nodes: [
    { id: 'trigger-manual', type: 'trigger', config: { triggerType: 'manual' } },
    { id: 'end', type: 'end', config: {} }
  ],
  edges: [{ id: 'edge-trigger-end', source: 'trigger-manual', target: 'end' }],
  metadata: { source: 'test' }
} as const;

describe('automation workflow graph validation', () => {
  it('normalizes and accepts canonical workflow graphs', () => {
    const graph = buildCanonicalAutomationWorkflowGraph({
      definition: { graph: validGraph }
    });

    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: 'trigger-manual', type: 'trigger', config: { triggerType: 'manual' } }),
      expect.objectContaining({ id: 'end', type: 'end', config: {} })
    ]);
    expect(graph.edges).toEqual([
      expect.objectContaining({ id: 'edge-trigger-end', source: 'trigger-manual', target: 'end' })
    ]);
    expect(graph.metadata).toEqual(validGraph.metadata);
    expect(() => validateAutomationWorkflowGraph(graph)).not.toThrow();
  });

  it('rejects empty graphs and graphs without trigger nodes', () => {
    expect(() => validateAutomationWorkflowGraph({ version: 1, nodes: [], edges: [], metadata: {} })).toThrowError(
      /at least one node/
    );

    const graph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [{ id: 'end', type: 'end', config: {} }],
        edges: []
      }
    });

    expect(() => validateAutomationWorkflowGraph(graph)).toThrowError(/trigger node/);
  });

  it('rejects unknown node types and invalid edge endpoints', () => {
    const unknownTypeGraph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger-manual', type: 'trigger', config: {} },
          { id: 'custom-node', type: 'unknown_custom_node', config: {} }
        ],
        edges: []
      }
    });

    expect(() => validateAutomationWorkflowGraph(unknownTypeGraph)).toThrowError(/Unknown automation workflow node type/);

    const danglingEdgeGraph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [{ id: 'trigger-manual', type: 'trigger', config: {} }],
        edges: [{ id: 'dangling', source: 'trigger-manual', target: 'missing-node' }]
      }
    });

    expect(() => validateAutomationWorkflowGraph(danglingEdgeGraph)).toThrowError(/edge target does not exist/);
  });

  it('rejects CRM business nodes with missing required config', () => {
    const graph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', config: { triggerType: 'work_item_moved_to_column', column: 'proposal_preparing' } },
          { id: 'proposal', type: 'create_proposal', config: { targetFieldSlug: 'proposalId' } }
        ],
        edges: [{ id: 'edge', source: 'trigger', target: 'proposal' }]
      }
    });

    expect(() => validateAutomationWorkflowGraph(graph)).toThrowError(/node config is invalid/);
  });

  it('rejects unreachable nodes, invalid cycles, and ambiguous duplicate triggers', () => {
    const unreachableGraph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', config: { triggerType: 'manual' } },
          { id: 'end', type: 'end', config: {} },
          { id: 'orphan', type: 'noop', config: {} }
        ],
        edges: [{ id: 'edge', source: 'trigger', target: 'end' }]
      }
    });
    expect(() => validateAutomationWorkflowGraph(unreachableGraph)).toThrowError(/unreachable nodes/);

    const cyclicGraph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', config: { triggerType: 'manual' } },
          { id: 'a', type: 'noop', config: {} },
          { id: 'b', type: 'noop', config: {} }
        ],
        edges: [
          { id: 'edge-1', source: 'trigger', target: 'a' },
          { id: 'edge-2', source: 'a', target: 'b' },
          { id: 'edge-3', source: 'b', target: 'a' }
        ]
      }
    });
    expect(() => validateAutomationWorkflowGraph(cyclicGraph)).toThrowError(/invalid cycle/);

    const duplicateTriggerGraph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger-a', type: 'trigger', config: { triggerType: 'proposal_status_changed', status: 'approved' } },
          { id: 'trigger-b', type: 'trigger', config: { triggerType: 'proposal_status_changed', status: 'approved' } },
          { id: 'end', type: 'end', config: {} }
        ],
        edges: [
          { id: 'edge-a', source: 'trigger-a', target: 'end' },
          { id: 'edge-b', source: 'trigger-b', target: 'end' }
        ]
      }
    });
    expect(() => validateAutomationWorkflowGraph(duplicateTriggerGraph)).toThrowError(/ambiguous duplicate triggers/);
  });

  it('rejects obvious event loops before publication', () => {
    const graph = buildCanonicalAutomationWorkflowGraph({
      graph: {
        version: 1,
        nodes: [
          { id: 'trigger', type: 'trigger', config: { triggerType: 'work_item_moved_to_column', column: 'proposal_sent' } },
          {
            id: 'move',
            type: 'move_work_item',
            config: {
              itemIdPath: 'event.payload.itemId',
              columnSlug: 'proposal_sent'
            }
          }
        ],
        edges: [{ id: 'edge', source: 'trigger', target: 'move' }]
      }
    });

    expect(() => validateAutomationWorkflowGraph(graph)).toThrowError(/loop on the same work item move event/);
  });
});
