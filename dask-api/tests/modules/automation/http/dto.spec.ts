import { describe, expect, it } from 'vitest';
import {
  automationRuleParamsDto,
  automationViewColumnParamsDto,
  automationViewParamsDto,
  createAutomationRuleDto,
  createAutomationViewColumnDto,
  createAutomationViewDto,
  itemPlacementParamsDto,
  listAutomationExecutionsQueryDto,
  listAutomationRulesQueryDto,
  listItemPlacementsParamsDto,
  patchAutomationRuleDto,
  patchAutomationViewColumnDto,
  patchAutomationViewDto,
  runAutomationRuleDto,
  upsertItemPlacementDto,
  workspaceIdParamsDto
} from '@/modules/automation/http/dto';

const UUIDS = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  ruleId: '22222222-2222-4222-8222-222222222222',
  viewId: '33333333-3333-4333-8333-333333333333',
  columnId: '44444444-4444-4444-8444-444444444444',
  itemId: '55555555-5555-4555-8555-555555555555'
};

describe('automation/http dto', () => {
  it('parses params and query dtos', () => {
    expect(workspaceIdParamsDto.parse({ workspaceId: UUIDS.workspaceId })).toEqual({
      workspaceId: UUIDS.workspaceId
    });
    expect(
      automationRuleParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        ruleId: UUIDS.ruleId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      ruleId: UUIDS.ruleId
    });
    expect(
      automationViewParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      viewId: UUIDS.viewId
    });
    expect(
      automationViewColumnParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        viewId: UUIDS.viewId,
        columnId: UUIDS.columnId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      viewId: UUIDS.viewId,
      columnId: UUIDS.columnId
    });

    expect(listAutomationRulesQueryDto.parse({ includeDisabled: 'true' }).includeDisabled).toBe(true);
    expect(listAutomationExecutionsQueryDto.parse({ limit: '15' }).limit).toBe(15);
  });

  it('parses rule payload dtos and validates non-empty patch', () => {
    const rule = createAutomationRuleDto.parse({
      workspaceId: UUIDS.workspaceId,
      name: 'Sync done to QA',
      trigger: { type: 'item.moved' },
      conditions: { sourceViewKeys: ['dev'] },
      actions: [{ type: 'set_view_column', targetViewKey: 'qa' }],
      enabled: true,
      priority: 10
    });
    expect(rule.name).toBe('Sync done to QA');

    expect(
      patchAutomationRuleDto.parse({
        enabled: false
      })
    ).toEqual({ enabled: false });

    expect(() => patchAutomationRuleDto.parse({})).toThrowError();

    expect(runAutomationRuleDto.parse({ workspaceId: UUIDS.workspaceId })).toEqual({
      workspaceId: UUIDS.workspaceId,
      context: {}
    });
  });

  it('parses view and column payload dtos and validates non-empty patches', () => {
    const view = createAutomationViewDto.parse({
      key: 'qa',
      name: 'QA',
      columns: [
        {
          key: 'ready',
          name: 'Ready',
          color: '#0d8df7'
        }
      ]
    });
    expect(view.columns?.[0]?.key).toBe('ready');

    expect(
      patchAutomationViewDto.parse({
        name: 'Quality Assurance',
        isActive: true
      })
    ).toEqual({
      name: 'Quality Assurance',
      isActive: true
    });
    expect(() => patchAutomationViewDto.parse({})).toThrowError();

    expect(
      createAutomationViewColumnDto.parse({
        key: 'doing',
        name: 'Doing',
        position: 1
      })
    ).toEqual({
      key: 'doing',
      name: 'Doing',
      position: 1
    });

    expect(
      patchAutomationViewColumnDto.parse({
        color: '#22c55e',
        isTerminal: true
      })
    ).toEqual({
      color: '#22c55e',
      isTerminal: true
    });
    expect(() => patchAutomationViewColumnDto.parse({})).toThrowError();
  });

  it('parses placement dtos', () => {
    expect(
      listItemPlacementsParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        itemId: UUIDS.itemId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      itemId: UUIDS.itemId
    });

    expect(
      itemPlacementParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        itemId: UUIDS.itemId,
        viewId: UUIDS.viewId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      itemId: UUIDS.itemId,
      viewId: UUIDS.viewId
    });

    expect(
      upsertItemPlacementDto.parse({
        columnId: UUIDS.columnId,
        position: 2,
        metadata: { copied: true }
      })
    ).toEqual({
      columnId: UUIDS.columnId,
      position: 2,
      metadata: { copied: true }
    });
  });
});
