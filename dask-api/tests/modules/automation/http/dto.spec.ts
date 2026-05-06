import { describe, expect, it } from 'vitest';
import {
  automationWorkflowParamsDto,
  automationWorkflowVersionParamsDto,
  automationViewColumnParamsDto,
  automationViewParamsDto,
  createAutomationWorkflowDto,
  createAutomationWorkflowDraftVersionDto,
  createAutomationViewColumnDto,
  createAutomationViewDto,
  itemPlacementParamsDto,
  listAutomationRunArtifactsQueryDto,
  listAutomationRunsQueryDto,
  listAutomationWorkflowsQueryDto,
  listAutomationWorkflowVersionsQueryDto,
  listItemPlacementsParamsDto,
  patchAutomationWorkflowDto,
  patchAutomationViewColumnDto,
  patchAutomationViewDto,
  publishAutomationWorkflowVersionDto,
  runAutomationWorkflowDto,
  updateAutomationWorkflowVersionDto,
  upsertItemPlacementDto,
  workspaceIdParamsDto
} from '@/modules/automation/http/dto';

const UUIDS = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  workflowId: '22222222-2222-4222-8222-222222222222',
  versionId: '66666666-6666-4666-8666-666666666666',
  viewId: '33333333-3333-4333-8333-333333333333',
  columnId: '44444444-4444-4444-8444-444444444444',
  itemId: '55555555-5555-4555-8555-555555555555'
};

const graph = {
  version: 1,
  nodes: [
    { id: 'trigger-manual', type: 'trigger', config: { triggerType: 'manual' } },
    { id: 'end', type: 'end', config: {} }
  ],
  edges: [{ id: 'edge-trigger-end', source: 'trigger-manual', target: 'end' }],
  metadata: { source: 'test' }
} as const;

describe('automation/http dto', () => {
  it('parses workflow params and list queries', () => {
    expect(workspaceIdParamsDto.parse({ workspaceId: UUIDS.workspaceId })).toEqual({
      workspaceId: UUIDS.workspaceId
    });
    expect(
      automationWorkflowParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        workflowId: UUIDS.workflowId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId
    });
    expect(
      automationWorkflowVersionParamsDto.parse({
        workspaceId: UUIDS.workspaceId,
        workflowId: UUIDS.workflowId,
        versionId: UUIDS.versionId
      })
    ).toEqual({
      workspaceId: UUIDS.workspaceId,
      workflowId: UUIDS.workflowId,
      versionId: UUIDS.versionId
    });

    expect(listAutomationWorkflowsQueryDto.parse({ status: 'active', limit: '15' })).toEqual({
      status: 'active',
      limit: 15
    });
    expect(listAutomationWorkflowVersionsQueryDto.parse({ status: 'draft', limit: '10' })).toEqual({
      status: 'draft',
      limit: 10
    });
    expect(listAutomationRunsQueryDto.parse({ workflowId: UUIDS.workflowId, limit: '25' })).toEqual({
      workflowId: UUIDS.workflowId,
      limit: 25
    });
    expect(listAutomationRunArtifactsQueryDto.parse({ limit: '20' })).toEqual({ limit: 20 });
  });

  it('parses workflow and version payloads', () => {
    expect(
      createAutomationWorkflowDto.parse({
        name: 'Follow-up de proposta',
        description: 'Operacao comercial',
        status: 'draft'
      })
    ).toEqual({
      name: 'Follow-up de proposta',
      description: 'Operacao comercial',
      status: 'draft'
    });

    expect(patchAutomationWorkflowDto.parse({ status: 'paused' })).toEqual({ status: 'paused' });
    expect(() => patchAutomationWorkflowDto.parse({})).toThrowError();

    expect(createAutomationWorkflowDraftVersionDto.parse({ graph })).toEqual({ graph });
    expect(updateAutomationWorkflowVersionDto.parse({ graph })).toEqual({ graph });
    expect(() => updateAutomationWorkflowVersionDto.parse({})).toThrowError();
    expect(publishAutomationWorkflowVersionDto.parse({ activateWorkflow: true })).toEqual({
      activateWorkflow: true
    });
    expect(runAutomationWorkflowDto.parse({ context: { contactId: UUIDS.itemId } })).toEqual({
      triggerType: 'manual',
      context: { contactId: UUIDS.itemId }
    });
  });

  it('parses view and column payload dtos and validates non-empty patches', () => {
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

    const view = createAutomationViewDto.parse({
      key: 'qa',
      name: 'QA',
      columns: [{ key: 'ready', name: 'Ready', color: '#0d8df7' }]
    });
    expect(view.columns?.[0]?.key).toBe('ready');

    expect(patchAutomationViewDto.parse({ name: 'Quality Assurance', isActive: true })).toEqual({
      name: 'Quality Assurance',
      isActive: true
    });
    expect(() => patchAutomationViewDto.parse({})).toThrowError();

    expect(createAutomationViewColumnDto.parse({ key: 'doing', name: 'Doing', position: 1 })).toEqual({
      key: 'doing',
      name: 'Doing',
      position: 1
    });

    expect(patchAutomationViewColumnDto.parse({ color: '#22c55e', isTerminal: true })).toEqual({
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
