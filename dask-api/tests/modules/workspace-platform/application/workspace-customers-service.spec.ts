import { describe, expect, it, vi } from 'vitest';
import { WorkspaceCustomersService } from '@/modules/workspace-platform/application/workspace-customers-service';
import { DomainEventNames } from '@/core/events/event-names';

function makeService() {
  const createdAt = new Date('2026-05-10T12:00:00.000Z');
  const customer = {
    id: 'customer-1',
    workspaceId: 'workspace-1',
    name: 'Acme',
    tradeName: 'Acme',
    legalName: 'Acme Tecnologia Ltda',
    document: '12345678000199',
    stateRegistration: null,
    municipalRegistration: null,
    taxRegime: null,
    email: 'maria@example.com',
    phone: '+55 11 99999-0000',
    website: null,
    logoUrl: null,
    address: null,
    status: 'prospect',
    notes: 'Quero falar com vendas',
    createdAt,
    updatedAt: createdAt
  };
  const tx = {
    item: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'item-1',
        title: 'Maria Silva',
        description: 'Quero falar com vendas',
        fields: {
          contactName: 'Maria Silva',
          contactEmail: 'maria@example.com',
          contactPhone: '+55 11 99999-0000',
          companyName: 'Acme',
          clientLegalName: 'Acme Tecnologia Ltda',
          clientDocument: '12345678000199'
        },
        metadata: { commercialIntake: { provider: 'GENERIC_WEBHOOK' } },
        createdBy: 'owner-1',
        updatedBy: 'owner-1'
      }),
      update: vi.fn().mockResolvedValue({})
    },
    customer: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue(customer)
    },
    customFieldDefinition: {
      findMany: vi.fn().mockResolvedValue([])
    },
    customFieldValue: {
      upsert: vi.fn()
    }
  };
  const prisma = {
    $transaction: vi.fn((callback) => callback(tx))
  };
  const configService = {
    ensureItemWritableWorkspace: vi.fn().mockResolvedValue({})
  };
  const eventPublisher = {
    publish: vi.fn(),
    publishInTransaction: vi.fn()
  };
  const service = new WorkspaceCustomersService(
    prisma as never,
    configService as never,
    eventPublisher as never
  );

  return { service, prisma, tx, configService, eventPublisher, customer };
}

describe('WorkspaceCustomersService conversion', () => {
  it('creates a Customer from official WorkItem fields when no customer payload is provided', async () => {
    const { service, tx, configService, eventPublisher } = makeService();

    const result = await service.convertWorkItemToCustomer({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'user-1',
      payload: {}
    });

    expect(configService.ensureItemWritableWorkspace).toHaveBeenCalledWith('workspace-1', 'user-1');
    expect(tx.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        name: 'Acme',
        tradeName: 'Acme',
        legalName: 'Acme Tecnologia Ltda',
        document: '12345678000199',
        email: 'maria@example.com',
        phone: '+55 11 99999-0000',
        notes: 'Quero falar com vendas',
        createdBy: 'user-1'
      })
    });
    expect(tx.item.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({
        fields: expect.objectContaining({
          customerId: 'customer-1',
          clientName: 'Acme',
          clientLegalName: 'Acme Tecnologia Ltda',
          clientDocument: '12345678000199',
          converted: true
        }),
        metadata: expect.objectContaining({
          commercialIntake: { provider: 'GENERIC_WEBHOOK' },
          customerConversion: expect.objectContaining({
            customerId: 'customer-1',
            convertedBy: 'user-1'
          })
        }),
        updatedBy: 'user-1'
      })
    });
    expect(eventPublisher.publishInTransaction).toHaveBeenCalledWith(expect.objectContaining({
      name: DomainEventNames.CustomerCreatedFromWorkItem,
      payload: expect.objectContaining({
        sourceWorkItemId: 'item-1',
        customerId: 'customer-1'
      })
    }), tx);
    expect(eventPublisher.publishInTransaction).toHaveBeenCalledWith(expect.objectContaining({
      name: DomainEventNames.CommercialWorkItemConvertedToCustomer,
      aggregateType: 'item',
      aggregateId: 'item-1'
    }), tx);
    expect(result).toEqual(expect.objectContaining({
      id: 'customer-1',
      name: 'Acme',
      email: 'maria@example.com'
    }));
  });
});
