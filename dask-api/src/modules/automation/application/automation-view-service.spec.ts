import { describe, expect, it, vi } from 'vitest';
import { AutomationViewService } from '@/modules/automation/application/automation-view-service';

function makeDeps() {
  const prisma = {
    automationView: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn()
    },
    automationViewColumn: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn()
    },
    workspacePreferences: {
      findUnique: vi.fn().mockResolvedValue(null)
    },
    item: {
      findFirst: vi.fn()
    },
    workItemViewPlacement: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    }
  };

  const workspaceConfigService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined),
    ensureConfigWritableWorkspace: vi.fn().mockResolvedValue(undefined),
    ensureItemWritableWorkspace: vi.fn().mockResolvedValue(undefined)
  };

  const service = new AutomationViewService(prisma as any, workspaceConfigService as any);

  return { prisma, workspaceConfigService, service };
}

function sampleView(viewId = 'view-1') {
  return {
    id: viewId,
    workspaceId: 'ws-1',
    key: 'dev',
    name: 'Development',
    description: null,
    position: 0,
    isSystem: true,
    isActive: true,
    settings: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    columns: [
      {
        id: 'col-1',
        workspaceId: 'ws-1',
        viewId,
        key: 'done',
        name: 'Done',
        description: null,
        color: '#22c55e',
        position: 1,
        isActive: true,
        isTerminal: true,
        settings: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }
    ],
    _count: { placements: 3 }
  };
}

describe('AutomationViewService', () => {
  it('seeds default views and columns', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.upsert.mockImplementation(async ({ where }: any) => ({
      id: `view-${where.workspaceId_key.key}`,
      workspaceId: where.workspaceId_key.workspaceId,
      key: where.workspaceId_key.key
    }));

    await service.ensureDefaultViews('ws-1');

    expect(prisma.automationView.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.automationViewColumn.upsert).toHaveBeenCalledTimes(4);
  });

  it('lists views and serializes columns', async () => {
    const { prisma, service, workspaceConfigService } = makeDeps();

    vi.spyOn(service, 'ensureDefaultViews').mockResolvedValue(undefined);
    prisma.automationView.findMany.mockResolvedValue([sampleView('view-dev')]);

    const views = await service.listViews({
      workspaceId: 'ws-1',
      userId: 'user-1'
    });

    expect(workspaceConfigService.ensureReadableWorkspace).toHaveBeenCalledWith('ws-1', 'user-1');
    expect(views[0].columns[0].id).toBe('col-1');
  });

  it('creates custom view and normalizes invalid color fallback for columns', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.aggregate.mockResolvedValue({ _max: { position: null } });
    prisma.automationView.create.mockResolvedValue({
      id: 'view-custom',
      workspaceId: 'ws-1',
      key: 'ops',
      name: 'Operations',
      description: 'Ops lens',
      position: 0,
      isSystem: false,
      isActive: true,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });
    prisma.automationView.findFirst.mockResolvedValue(sampleView('view-custom'));

    await service.createView({
      workspaceId: 'ws-1',
      userId: 'user-1',
      payload: {
        key: 'ops',
        name: 'Operations',
        columns: [{ key: '', name: 'Triage', color: 'invalid' }]
      }
    });

    expect(prisma.automationViewColumn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: 'triage', color: '#64748b' })
      })
    );
  });

  it('creates view deriving key from name and without explicit columns array', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.aggregate.mockResolvedValue({ _max: { position: 1 } });
    prisma.automationView.create.mockResolvedValue({
      id: 'view-derived',
      workspaceId: 'ws-1',
      key: 'ops-board',
      name: 'Ops Board',
      description: null,
      position: 2,
      isSystem: false,
      isActive: true,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });
    prisma.automationView.findFirst.mockResolvedValue(sampleView('view-derived'));

    await service.createView({
      workspaceId: 'ws-1',
      userId: 'user-1',
      payload: {
        key: '',
        name: 'Ops Board'
      }
    });

    expect(prisma.automationView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'ops-board',
          position: 2
        })
      })
    );
    expect(prisma.automationViewColumn.create).not.toHaveBeenCalled();
  });

  it('rejects invalid view key', async () => {
    const { service } = makeDeps();

    await expect(
      service.createView({
        workspaceId: 'ws-1',
        userId: 'user-1',
        payload: {
          key: '   ',
          name: '***'
        }
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('updates existing view and returns serialized payload', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst
      .mockResolvedValueOnce({ id: 'view-1' })
      .mockResolvedValueOnce(sampleView('view-1'));

    await service.updateView({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        name: 'Updated',
        settings: { lane: 'critical' }
      }
    });

    expect(prisma.automationView.update).toHaveBeenCalled();
  });

  it('throws when updating missing view', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationView.findFirst.mockResolvedValue(null);

    await expect(
      service.updateView({
        workspaceId: 'ws-1',
        viewId: 'missing',
        userId: 'user-1',
        payload: { name: 'X' }
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates view without settings patch and leaves settings undefined', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst
      .mockResolvedValueOnce({ id: 'view-1' })
      .mockResolvedValueOnce(sampleView('view-1'));

    await service.updateView({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        name: 'Only name'
      }
    });

    expect(prisma.automationView.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: undefined
        })
      })
    );
  });

  it('maps null view settings to an empty object on update', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst
      .mockResolvedValueOnce({ id: 'view-1' })
      .mockResolvedValueOnce(sampleView('view-1'));

    await service.updateView({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        settings: null as any
      } as any
    });

    expect(prisma.automationView.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: {}
        })
      })
    );
  });

  it('lists view columns', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findMany.mockResolvedValue([
      {
        id: 'col-1',
        workspaceId: 'ws-1',
        viewId: 'view-1',
        key: 'ready',
        name: 'Ready',
        description: null,
        color: '#0d8df7',
        position: 0,
        isActive: true,
        isTerminal: false,
        settings: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }
    ]);

    const columns = await service.listViewColumns({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1'
    });

    expect(columns).toHaveLength(1);
  });

  it('creates view column and respects valid color normalization branch', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.aggregate.mockResolvedValue({ _max: { position: 2 } });
    prisma.automationViewColumn.create.mockResolvedValue({
      id: 'col-1',
      workspaceId: 'ws-1',
      viewId: 'view-1',
      key: 'ready',
      name: 'Ready',
      description: null,
      color: '#abcdef',
      position: 3,
      isActive: true,
      isTerminal: false,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    const column = await service.createViewColumn({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        key: 'ready',
        name: 'Ready',
        color: '#ABCDEF'
      }
    });

    expect(column.color).toBe('#abcdef');
  });

  it('rejects invalid view column key', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });

    await expect(
      service.createViewColumn({
        workspaceId: 'ws-1',
        viewId: 'view-1',
        userId: 'user-1',
        payload: {
          key: '   ',
          name: '***'
        }
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('creates view column deriving key from name when key is empty', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.aggregate.mockResolvedValue({ _max: { position: 0 } });
    prisma.automationViewColumn.create.mockResolvedValue({
      id: 'col-derived',
      workspaceId: 'ws-1',
      viewId: 'view-1',
      key: 'ready-to-test',
      name: 'Ready To Test',
      description: null,
      color: '#64748b',
      position: 1,
      isActive: true,
      isTerminal: false,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    await service.createViewColumn({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        key: '',
        name: 'Ready To Test'
      }
    });

    expect(prisma.automationViewColumn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'ready-to-test'
        })
      })
    );
  });

  it('updates view column and covers color update branches', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({
      id: 'col-1',
      color: '#ffffff'
    });
    prisma.automationViewColumn.update.mockResolvedValue({
      id: 'col-1',
      workspaceId: 'ws-1',
      viewId: 'view-1',
      key: 'ready',
      name: 'Ready',
      description: null,
      color: '#123456',
      position: 1,
      isActive: true,
      isTerminal: false,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    const column = await service.updateViewColumn({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      columnId: 'col-1',
      userId: 'user-1',
      payload: {
        color: '#123456',
        settings: { mode: 'strict' }
      }
    });

    expect(column.color).toBe('#123456');
  });

  it('throws when updating missing view column', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue(null);

    await expect(
      service.updateViewColumn({
        workspaceId: 'ws-1',
        viewId: 'view-1',
        columnId: 'missing',
        userId: 'user-1',
        payload: { name: 'X' }
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates view column without color/settings and keeps both undefined in patch', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({
      id: 'col-1',
      color: '#ffffff'
    });
    prisma.automationViewColumn.update.mockResolvedValue({
      id: 'col-1',
      workspaceId: 'ws-1',
      viewId: 'view-1',
      key: 'ready',
      name: 'Ready',
      description: null,
      color: '#ffffff',
      position: 1,
      isActive: true,
      isTerminal: false,
      settings: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    await service.updateViewColumn({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      columnId: 'col-1',
      userId: 'user-1',
      payload: {
        name: 'Ready'
      }
    });

    expect(prisma.automationViewColumn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: undefined,
          settings: undefined
        })
      })
    );
  });

  it('maps null column settings to an empty object on update', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({
      id: 'col-1',
      color: '#ffffff'
    });
    prisma.automationViewColumn.update.mockResolvedValue({
      id: 'col-1',
      workspaceId: 'ws-1',
      viewId: 'view-1',
      key: 'ready',
      name: 'Ready',
      description: null,
      color: '#ffffff',
      position: 1,
      isActive: true,
      isTerminal: false,
      settings: {},
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    await service.updateViewColumn({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      columnId: 'col-1',
      userId: 'user-1',
      payload: {
        settings: null as any
      } as any
    });

    expect(prisma.automationViewColumn.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settings: {}
        })
      })
    );
  });

  it('lists item placements with serialized view+column', async () => {
    const { prisma, service } = makeDeps();

    prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.workItemViewPlacement.findMany.mockResolvedValue([
      {
        id: 'placement-1',
        workspaceId: 'ws-1',
        itemId: 'item-1',
        viewId: 'view-1',
        columnId: 'col-1',
        position: 1,
        metadata: { foo: 'bar' },
        updatedBy: 'user-1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        view: { id: 'view-1', key: 'qa', name: 'QA' },
        column: { id: 'col-1', key: 'ready', name: 'Ready', color: '#0d8df7' }
      }
    ]);

    const placements = await service.listItemPlacements({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      userId: 'user-1'
    });

    expect(placements[0].view.key).toBe('qa');
  });

  it('throws when listing placements for unknown item', async () => {
    const { prisma, service } = makeDeps();
    prisma.item.findFirst.mockResolvedValue(null);

    await expect(
      service.listItemPlacements({
        workspaceId: 'ws-1',
        itemId: 'missing',
        userId: 'user-1'
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('upserts and removes item placement', async () => {
    const { prisma, service } = makeDeps();

    prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-1' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue({
      id: 'placement-1',
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      columnId: 'col-1',
      position: 0,
      metadata: null,
      updatedBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      view: { id: 'view-1', key: 'qa', name: 'QA' },
      column: { id: 'col-1', key: 'ready', name: 'Ready', color: '#0d8df7' }
    });

    await service.upsertItemPlacement({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        columnId: 'col-1',
        metadata: {}
      }
    });

    await service.removeItemPlacement({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      userId: 'user-1'
    });

    expect(prisma.workItemViewPlacement.deleteMany).toHaveBeenCalled();
  });

  it('upserts item placement without metadata and keeps update metadata undefined', async () => {
    const { prisma, service } = makeDeps();

    prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-1' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue({
      id: 'placement-1',
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      columnId: 'col-1',
      position: 0,
      metadata: null,
      updatedBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      view: { id: 'view-1', key: 'qa', name: 'QA' },
      column: { id: 'col-1', key: 'ready', name: 'Ready', color: '#0d8df7' }
    });

    await service.upsertItemPlacement({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        columnId: 'col-1'
      }
    });

    expect(prisma.workItemViewPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          metadata: undefined
        })
      })
    );
  });

  it('maps null placement metadata to an empty object on update payload', async () => {
    const { prisma, service } = makeDeps();

    prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-1' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue({
      id: 'placement-1',
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      columnId: 'col-1',
      position: 0,
      metadata: {},
      updatedBy: 'user-1',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      view: { id: 'view-1', key: 'qa', name: 'QA' },
      column: { id: 'col-1', key: 'ready', name: 'Ready', color: '#0d8df7' }
    });

    await service.upsertItemPlacement({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      viewId: 'view-1',
      userId: 'user-1',
      payload: {
        columnId: 'col-1',
        metadata: null as any
      } as any
    });

    expect(prisma.workItemViewPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          metadata: {}
        })
      })
    );
  });

  it('resolves views and columns by id/key and errors when missing', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst
      .mockResolvedValueOnce({ id: 'view-1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'view-2' })
      .mockResolvedValueOnce(null);

    prisma.automationViewColumn.findFirst
      .mockResolvedValueOnce({ id: 'col-1' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'col-2' })
      .mockResolvedValueOnce(null);

    const byId = await service.resolveViewByReference({
      workspaceId: 'ws-1',
      viewId: 'view-1'
    });
    expect(byId.id).toBe('view-1');

    const byKey = await service.resolveViewByReference({
      workspaceId: 'ws-1',
      viewId: 'missing',
      viewKey: 'qa'
    });
    expect(byKey.id).toBe('view-2');

    await expect(
      service.resolveViewByReference({ workspaceId: 'ws-1', viewKey: 'none' })
    ).rejects.toMatchObject({ statusCode: 404 });

    const columnById = await service.resolveColumnByReference({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      columnId: 'col-1'
    });
    expect(columnById.id).toBe('col-1');

    const columnByKey = await service.resolveColumnByReference({
      workspaceId: 'ws-1',
      viewId: 'view-1',
      columnId: 'missing',
      columnKey: 'ready'
    });
    expect(columnByKey.id).toBe('col-2');

    await expect(
      service.resolveColumnByReference({ workspaceId: 'ws-1', viewId: 'view-1', columnKey: 'none' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('covers private not-found helper branches and next position defaults', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue(null);
    prisma.automationViewColumn.findFirst.mockResolvedValue(null);
    prisma.item.findFirst.mockResolvedValue(null);
    prisma.automationView.aggregate.mockResolvedValue({ _max: { position: null } });
    prisma.automationViewColumn.aggregate.mockResolvedValue({ _max: { position: null } });

    await expect((service as any).getViewOrThrow('ws-1', 'view-1')).rejects.toMatchObject({ statusCode: 404 });
    await expect((service as any).ensureViewBelongsToWorkspace('ws-1', 'view-1')).rejects.toMatchObject({
      statusCode: 404
    });
    await expect((service as any).ensureColumnBelongsToView('ws-1', 'view-1', 'col-1')).rejects.toMatchObject({
      statusCode: 404
    });
    await expect((service as any).ensureItemBelongsToWorkspace('ws-1', 'item-1')).rejects.toMatchObject({
      statusCode: 404
    });

    expect(await (service as any).nextViewPosition('ws-1')).toBe(0);
    expect(await (service as any).nextViewColumnPosition('ws-1', 'view-1')).toBe(0);
  });
});
