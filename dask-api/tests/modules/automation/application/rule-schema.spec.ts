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
