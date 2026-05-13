import { describe, expect, it } from 'vitest';
import {
  automationNativeWorkflowCatalog,
  deprecatedInternalAutomationRecipeCatalog,
  getAutomationCapabilities
} from '@/modules/automation/application/automation-capabilities';
import { validateAutomationWorkflowGraph } from '@/modules/automation/application/automation-workflow-graph-validation';

describe('automation business capabilities', () => {
  it('publishes CRM business nodes in the automation catalog', () => {
    const capabilities = getAutomationCapabilities();
    const nodeTypes = capabilities.nodeCatalog.map((node) => node.type);

    expect(nodeTypes).toEqual(
      expect.arrayContaining([
        'move_work_item',
        'update_work_item_fields',
        'replicate_work_item_type_fields',
        'transform_work_item_type',
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

  it('ships executable native commercial workflows that validate with official nodes only', () => {
    const capabilities = getAutomationCapabilities();
    const officialTypes = new Set(capabilities.nodeCatalog.map((node) => node.type));

    expect(capabilities.nativeWorkflowCatalog.map((workflow) => workflow.nativeKey)).toEqual(
      expect.arrayContaining([
        'commercial.intake',
        'commercial.hot_opportunity',
        'commercial.first_contact',
        'commercial.no_response_followup',
        'commercial.proposal_drafting',
        'commercial.proposal_approved_to_contract',
        'commercial.contract_accepted_to_billing',
        'commercial.payment_confirmed_to_active_customer',
        'commercial.overdue_charge'
      ])
    );
    expect(capabilities.nativeWorkflowCatalog).toHaveLength(9);

    for (const workflow of capabilities.nativeWorkflowCatalog) {
      expect(workflow.nativeDomain).toBe('commercial');
      expect(workflow.isSystemManaged).toBe(true);
      expect(workflow.isProtected).toBe(true);
      expect(workflow).not.toHaveProperty('graph');
    }

    for (const workflow of automationNativeWorkflowCatalog) {
      expect(workflow.graph.metadata).not.toHaveProperty('recipe');
      expect(workflow.graph.nodes.every((node) => officialTypes.has(node.type))).toBe(true);
      expect(() => validateAutomationWorkflowGraph(workflow.graph)).not.toThrow();
    }
  });

  it('models native commercial workflows as CRM operations over WorkItems', () => {
    const workItemActionTypes = new Set([
      'move_work_item',
      'update_work_item_fields',
      'create_proposal',
      'create_contract',
      'ensure_customer_from_work_item',
      'create_billing_order',
      'create_followup_task',
      'register_card_activity'
    ]);
    const expectedOperationalSteps = new Map([
      ['commercial.intake', ['commercial_work_item_created', 'move_work_item', 'register_card_activity']],
      ['commercial.proposal_drafting', ['work_item_moved_to_column', 'create_proposal']],
      ['commercial.proposal_approved_to_contract', ['proposal_status_changed', 'create_contract']],
      ['commercial.contract_accepted_to_billing', ['contract_status_changed', 'create_billing_order']],
      ['commercial.payment_confirmed_to_active_customer', ['billing_payment_confirmed', 'ensure_customer_from_work_item']],
      ['commercial.overdue_charge', ['billing_overdue', 'create_followup_task']]
    ]);

    for (const workflow of automationNativeWorkflowCatalog) {
      expect(workflow.nativeDomain).toBe('commercial');
      expect(workflow.graph.metadata).toEqual(expect.objectContaining({
        native: true,
        source: 'work_item'
      }));
      expect(JSON.stringify(workflow.graph).toLowerCase()).not.toContain('leadid');

      const triggerNodes = workflow.graph.nodes.filter((node) => node.type === 'trigger');
      expect(triggerNodes.length).toBeGreaterThan(0);
      for (const trigger of triggerNodes) {
        expect(trigger.config.itemTypeSlugs ?? trigger.config.itemTypeSlug).toEqual(
          expect.arrayContaining(['commercial'])
        );
      }

      for (const node of workflow.graph.nodes) {
        if (workItemActionTypes.has(node.type)) {
          expect(node.config.itemIdPath).toBe('event.payload.itemId');
        }
        if (node.type === 'human_approval') {
          expect(node.config.workItemId).toBe('{{event.payload.itemId}}');
        }
        if (node.type === 'communication_send') {
          expect(node.config.metadata).toEqual(expect.objectContaining({
            itemId: '{{event.payload.itemId}}',
            workItemId: '{{event.payload.itemId}}',
            nativeDomain: 'commercial'
          }));
        }
      }
    }

    for (const [nativeKey, expected] of expectedOperationalSteps) {
      const workflow = automationNativeWorkflowCatalog.find((item) => item.nativeKey === nativeKey);
      expect(workflow).toBeDefined();
      const graphTokens = workflow?.graph.nodes.flatMap((node) => [
        node.type,
        typeof node.config.triggerType === 'string' ? node.config.triggerType : ''
      ]) ?? [];
      expect(graphTokens).toEqual(expect.arrayContaining(expected));
    }
  });

  it('publishes nodes as the primary capabilities contract without visible recipes', () => {
    const capabilities = getAutomationCapabilities();
    const nativeLegacyIds = new Set(automationNativeWorkflowCatalog.map((workflow) => workflow.legacyRecipeId));

    expect(capabilities.runtime).toEqual(expect.objectContaining({
      creationSource: 'nodes',
      supportsEmptyWorkflow: true,
      supportsNativeWorkflows: true,
      requiresPublishedVersionToRun: true
    }));
    expect(capabilities.nodeCatalog.length).toBeGreaterThan(0);
    expect(capabilities.recipeCatalog).toEqual([]);
    expect(capabilities.recipeCatalog.some((recipe) => nativeLegacyIds.has(recipe.id))).toBe(false);
  });

  it('keeps legacy recipes only as deprecated internal compatibility definitions', () => {
    const nativeLegacyIds = new Set(automationNativeWorkflowCatalog.map((workflow) => workflow.legacyRecipeId));

    expect(deprecatedInternalAutomationRecipeCatalog.length).toBeGreaterThan(0);
    expect(deprecatedInternalAutomationRecipeCatalog.every((recipe) => recipe.deprecated)).toBe(true);
    expect(deprecatedInternalAutomationRecipeCatalog.every((recipe) => recipe.internal)).toBe(true);
    expect(deprecatedInternalAutomationRecipeCatalog.every((recipe) => recipe.visibility === 'internal')).toBe(true);
    expect(
      deprecatedInternalAutomationRecipeCatalog
        .filter((recipe) => nativeLegacyIds.has(recipe.id))
        .every((recipe) => recipe.replacedBy?.kind === 'native_workflow')
    ).toBe(true);
  });
});
