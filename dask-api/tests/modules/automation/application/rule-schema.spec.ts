import { describe, expect, it } from 'vitest';
import { AppError } from '@/core/errors/app-error';
import { matchesConditions, parseRuleSpec } from '@/modules/automation/application/rule-schema';

describe('rule-schema', () => {
  it('parses a valid automation rule spec', () => {
    const spec = parseRuleSpec({
      trigger: { type: 'item.moved' },
      conditions: {
        sourceViewKeys: ['dev'],
        toColumnKeys: ['done']
      },
      actions: [
        {
          type: 'set_view_column',
          targetViewKey: 'qa',
          targetColumnKey: 'ready-for-test'
        }
      ]
    });

    expect(spec.trigger.type).toBe('item.moved');
    expect(spec.actions).toHaveLength(1);
  });

  it('rejects invalid rule spec', () => {
    expect(() =>
      parseRuleSpec({
        trigger: { type: 'item.moved' },
        actions: [
          {
            type: 'set_view_column'
          }
        ]
      })
    ).toThrowError(AppError);
  });

  it('matches conditions when all filters pass', () => {
    const matches = matchesConditions(
      {
        sourceViewKeys: ['dev'],
        fromColumnKeys: ['review'],
        toColumnKeys: ['done'],
        statuses: ['done'],
        priorities: [3]
      },
      {
        sourceViewKey: 'dev',
        fromColumnKey: 'review',
        toColumnKey: 'done',
        status: 'done',
        priority: 3
      }
    );

    expect(matches).toBe(true);
  });

  it('fails condition matching when one filter does not match', () => {
    const matches = matchesConditions(
      {
        sourceViewKeys: ['dev'],
        toColumnKeys: ['done']
      },
      {
        sourceViewKey: 'qa',
        toColumnKey: 'done'
      }
    );

    expect(matches).toBe(false);
  });

  it('accepts undefined conditions', () => {
    expect(matchesConditions(undefined, {})).toBe(true);
  });

  it('validates remove_from_view requires target view', () => {
    expect(() =>
      parseRuleSpec({
        trigger: { type: 'item.updated' },
        actions: [{ type: 'remove_from_view' }]
      })
    ).toThrowError(AppError);
  });

  it('validates set_work_item_state requires at least one target field', () => {
    expect(() =>
      parseRuleSpec({
        trigger: { type: 'item.updated' },
        actions: [{ type: 'set_work_item_state' }]
      })
    ).toThrowError(AppError);
  });

  it('parses commercial document automation actions and triggers', () => {
    const spec = parseRuleSpec({
      trigger: { type: 'proposal.approved' },
      actions: [
        { type: 'set_work_item_state', stateSlug: 'contract_preparing' },
        {
          type: 'create_document',
          kind: 'contract',
          binding: 'commercial_contract',
          targetFieldSlug: 'contractId',
          validations: ['commercial.contract.required_fields']
        }
      ]
    });

    expect(spec.trigger.type).toBe('proposal.approved');
    expect(spec.actions[1]?.type).toBe('create_document');
  });

  it('matches commercial underscore column keys and statuses correctly', () => {
    const matches = matchesConditions(
      {
        itemTypeSlugs: ['commercial'],
        toColumnKeys: ['lead_qualification'],
        statuses: ['lead_qualification']
      },
      {
        itemTypeSlug: 'commercial',
        toColumnKey: 'lead_qualification',
        status: 'lead_qualification'
      }
    );

    expect(matches).toBe(true);
  });

  it('does not match when commercial status uses dashes instead of underscores', () => {
    const matches = matchesConditions(
      {
        toColumnKeys: ['lead_qualification'],
        statuses: ['lead_qualification']
      },
      {
        toColumnKey: 'lead-qualification',
        status: 'lead-qualification'
      }
    );

    expect(matches).toBe(false);
  });

  it('parses set_work_item_state with underscore slug for commercial workflow', () => {
    const spec = parseRuleSpec({
      trigger: { type: 'item.moved' },
      conditions: {
        itemTypeSlugs: ['commercial'],
        toColumnKeys: ['lead_qualification'],
        statuses: ['lead_qualification']
      },
      actions: [{ type: 'set_work_item_state', stateSlug: 'opportunity_open' }]
    });

    expect(spec.actions[0]).toMatchObject({ type: 'set_work_item_state', stateSlug: 'opportunity_open' });
  });

  it('fails when expected string/number filters receive empty or invalid actual values', () => {
    expect(
      matchesConditions(
        {
          statuses: ['done']
        },
        {
          status: undefined
        }
      )
    ).toBe(false);

    expect(
      matchesConditions(
        {
          priorities: [2]
        },
        {
          priority: null
        }
      )
    ).toBe(false);
  });
});
