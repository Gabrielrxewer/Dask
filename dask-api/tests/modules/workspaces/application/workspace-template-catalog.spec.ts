import { describe, expect, it } from 'vitest';
import { getWorkspaceTemplateByKey } from '@/modules/workspaces/application/workspace-template-catalog';

describe('workspace-template-catalog', () => {
  it('includes document lifecycle automations for the commercial template', () => {
    const template = getWorkspaceTemplateByKey('commercial_crm');
    const automations = Array.isArray(template?.schema.automations) ? template.schema.automations : [];

    expect(automations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'move_to_proposal_sent_on_proposal_sent',
          trigger: { type: 'proposal_status_changed', status: 'sent' },
          actions: [{ type: 'set_work_item_state', stateSlug: 'proposal_sent' }]
        }),
        expect.objectContaining({
          id: 'move_to_contract_sent_on_contract_sent',
          trigger: { type: 'contract_status_changed', status: 'sent' },
          actions: [{ type: 'set_work_item_state', stateSlug: 'contract_sent' }]
        }),
        expect.objectContaining({
          id: 'move_to_contract_accepted_on_contract_accepted',
          trigger: { type: 'contract_status_changed', status: 'accepted' },
          actions: [{ type: 'set_work_item_state', stateSlug: 'contract_accepted' }]
        }),
        expect.objectContaining({
          id: 'create_customer_on_contract_accepted',
          trigger: { type: 'work_item_moved_to_column', column: 'contract_accepted' },
          actions: [{ type: 'ensure_customer_from_work_item', targetFieldSlug: 'customerId', status: 'active' }]
        }),
        expect.objectContaining({
          id: 'prepare_billing_on_contract_accepted',
          enabled: true,
          trigger: { type: 'work_item_moved_to_column', column: 'contract_accepted' },
          actions: expect.arrayContaining([
            { type: 'create_billing_order', targetFieldSlug: 'billingOrderId' }
          ])
        }),
        expect.objectContaining({
          id: 'move_to_paid_active_on_payment_confirmed',
          enabled: true,
          trigger: { type: 'billing_payment_confirmed', status: 'paid' },
          actions: [{ type: 'set_work_item_state', stateSlug: 'paid_active' }]
        })
      ])
    );
  });

  it('includes billing status fields for the commercial template', () => {
    const template = getWorkspaceTemplateByKey('commercial_crm');
    const fields = template?.schema.fieldDefinitions ?? [];
    const bindings = template?.schema.fieldBindings ?? [];

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'billingStatus',
          slug: 'billingStatus',
          type: 'select'
        }),
        expect.objectContaining({
          id: 'billingCheckoutUrl',
          slug: 'billingCheckoutUrl'
        })
      ])
    );
    expect(bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldId: 'billingStatus', displayContext: 'card' }),
        expect.objectContaining({ fieldId: 'billingStatus', displayContext: 'detail' })
      ])
    );
  });
});
