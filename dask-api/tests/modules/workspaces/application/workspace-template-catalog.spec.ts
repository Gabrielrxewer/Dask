import { describe, expect, it } from 'vitest';
import { getWorkspaceTemplateByKey } from '@/modules/workspaces/application/workspace-template-catalog';

describe('workspace-template-catalog', () => {
  it('includes document lifecycle automations for the commercial template', () => {
    const template = getWorkspaceTemplateByKey('commercial_crm');
    const recipeIds = template?.schema.automationRecipeIds ?? [];

    expect(recipeIds).toEqual(
      expect.arrayContaining([
        'commercial-work-item-created-to-intake',
        'proposal-preparing-create-proposal',
        'proposal-approved-create-contract',
        'contract-accepted-create-billing',
        'payment-confirmed-active-customer',
        'billing-overdue-finance-alert'
      ])
    );
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
