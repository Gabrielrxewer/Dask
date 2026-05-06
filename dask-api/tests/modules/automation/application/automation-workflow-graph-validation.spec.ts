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
});
