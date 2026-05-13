import { describe, expect, it } from 'vitest';
import { getWorkspaceTemplateByKey } from '@/modules/workspaces/application/workspace-template-catalog';

describe('workspace-template-catalog', () => {
  it('includes document lifecycle automations for the commercial template', () => {
    const template = getWorkspaceTemplateByKey('commercial_crm');
    const nativeWorkflowKeys = template?.schema.automationNativeWorkflowKeys ?? [];

    expect(nativeWorkflowKeys).toEqual(
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
    expect(nativeWorkflowKeys).toHaveLength(9);
    expect(template?.schema.automationRecipeIds).toBeUndefined();
    expect(template?.schema.automations).toBeUndefined();
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
