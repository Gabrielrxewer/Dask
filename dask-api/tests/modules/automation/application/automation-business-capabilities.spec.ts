import { describe, expect, it } from 'vitest';
import { getAutomationCapabilities } from '@/modules/automation/application/automation-capabilities';
import { validateAutomationWorkflowGraph } from '@/modules/automation/application/automation-workflow-graph-validation';

describe('automation business capabilities', () => {
  it('publishes CRM business nodes in the automation catalog', () => {
    const capabilities = getAutomationCapabilities();
    const nodeTypes = capabilities.nodeCatalog.map((node) => node.type);

    expect(nodeTypes).toEqual(
      expect.arrayContaining([
        'move_work_item',
        'update_work_item_fields',
        'create_proposal',
        'create_contract',
        'send_document',
        'update_document_status',
        'ensure_customer_from_work_item',
        'create_billing_order',
        'create_followup_task',
        'register_card_activity'
      ])
    );
  });

  it('validates published workflow graphs that use CRM business nodes', () => {
    expect(() =>
      validateAutomationWorkflowGraph({
        version: 1,
        nodes: [
          {
            id: 'trigger-card-moved',
            type: 'trigger',
            label: 'Card entrou em proposta',
            config: {
              triggerType: 'work_item_moved_to_column',
              column: 'proposal_preparing'
            }
          },
          {
            id: 'create-proposal',
            type: 'create_proposal',
            label: 'Criar proposta',
            config: {
              itemIdPath: 'event.payload.itemId',
              templateKey: 'commercial_proposal',
              targetFieldSlug: 'proposalId',
              skipIfExists: true
            }
          },
          {
            id: 'create-contract',
            type: 'create_contract',
            label: 'Criar contrato',
            config: {
              itemIdPath: 'event.payload.itemId',
              templateKey: 'commercial_contract',
              proposalFieldSlug: 'proposalId',
              targetFieldSlug: 'contractId',
              skipIfExists: true
            }
          },
          {
            id: 'move-card',
            type: 'move_work_item',
            label: 'Mover para proposta enviada',
            config: {
              itemIdPath: 'event.payload.itemId',
              stateSlug: 'proposal_sent'
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'trigger-card-moved',
            target: 'create-proposal'
          },
          {
            id: 'edge-2',
            source: 'create-proposal',
            target: 'create-contract'
          },
          {
            id: 'edge-3',
            source: 'create-contract',
            target: 'move-card'
          }
        ]
      })
    ).not.toThrow();
  });

  it('ships executable CRM recipes that validate with official nodes only', () => {
    const capabilities = getAutomationCapabilities();
    const officialTypes = new Set(capabilities.nodeCatalog.map((node) => node.type));

    expect(capabilities.recipeCatalog.map((recipe) => recipe.id)).toEqual(
      expect.arrayContaining([
        'lead-captured-to-new-lead',
        'first-contact-on-new-lead',
        'proposal-preparing-create-proposal',
        'proposal-approved-create-contract',
        'contract-accepted-create-billing',
        'payment-confirmed-active-customer',
        'billing-overdue-finance-alert'
      ])
    );

    for (const recipe of capabilities.recipeCatalog) {
      expect(recipe.graph.nodes.every((node) => officialTypes.has(node.type))).toBe(true);
      expect(() => validateAutomationWorkflowGraph(recipe.graph)).not.toThrow();
    }
  });
});
