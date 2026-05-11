import { describe, expect, it } from 'vitest';
import {
  bulkUpdateWorkItemsDto,
  workItemListConfigDto,
  workItemListQueryDto
} from '@/modules/workspace-platform/http/dto';

const UUIDS = {
  itemA: '11111111-1111-4111-8111-111111111111',
  itemB: '22222222-2222-4222-8222-222222222222',
  state: '33333333-3333-4333-8333-333333333333',
  assignee: '44444444-4444-4444-8444-444444444444'
};

describe('workspace-platform/http dto', () => {
  it('normalizes list query filters for server-side list operations', () => {
    expect(
      workItemListQueryDto.parse({
        paged: 'true',
        page: '2',
        pageSize: '25',
        assignedToMe: '1',
        workflowStateIds: `${UUIDS.state},${UUIDS.itemA}`,
        customFieldFilters: JSON.stringify([{ fieldKey: 'customerId', value: UUIDS.itemB }]),
        sortBy: 'dueDate',
        sortDirection: 'asc'
      })
    ).toEqual({
      paged: true,
      page: 2,
      pageSize: 25,
      assignedToMe: true,
      workflowStateIds: [UUIDS.state, UUIDS.itemA],
      customFieldFilters: [{ fieldKey: 'customerId', value: UUIDS.itemB }],
      sortBy: 'dueDate',
      sortDirection: 'asc'
    });
  });

  it('validates bulk update payloads with at least one patch field', () => {
    expect(
      bulkUpdateWorkItemsDto.parse({
        itemIds: [UUIDS.itemA, UUIDS.itemB],
        patch: {
          stateId: UUIDS.state,
          assigneeId: UUIDS.assignee,
          priority: 3,
          archived: true
        }
      })
    ).toEqual({
      itemIds: [UUIDS.itemA, UUIDS.itemB],
      patch: {
        stateId: UUIDS.state,
        assigneeId: UUIDS.assignee,
        priority: 3,
        archived: true
      }
    });

    expect(() => bulkUpdateWorkItemsDto.parse({ itemIds: [UUIDS.itemA], patch: {} })).toThrowError();
  });

  it('validates persisted list config payloads', () => {
    expect(
      workItemListConfigDto.parse({
        id: 'workspace:type:list',
        workspaceId: UUIDS.itemA,
        workItemTypeId: UUIDS.itemB,
        schemaVersion: 1,
        name: 'Lista operacional',
        columns: [
          {
            id: 'title',
            fieldKey: 'title',
            label: 'Titulo',
            type: 'title',
            visible: true,
            order: 0,
            required: true
          }
        ],
        mobileCardLayout: {
          titleField: 'title',
          subtitleFields: [],
          badgeFields: [],
          primaryMetaFields: [],
          secondaryMetaFields: [],
          actions: ['open']
        }
      })
    ).toMatchObject({
      schemaVersion: 1,
      density: 'compact',
      bulkActions: [],
      mobileCardLayout: {
        titleField: 'title'
      }
    });
  });
});
