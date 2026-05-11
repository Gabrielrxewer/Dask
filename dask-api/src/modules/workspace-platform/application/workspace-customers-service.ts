import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import { isRecord } from '@/modules/workspace-platform/application/shared';

export type CustomerStatus = 'prospect' | 'active' | 'inactive' | 'archived';

type CustomerAddress = {
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
};

type CustomerPayload = {
  name: string;
  tradeName?: string | null;
  legalName?: string | null;
  document?: string | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  taxRegime?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  address?: CustomerAddress | null;
  status?: CustomerStatus;
  notes?: string | null;
  sourceWorkItemId?: string | null;
};

const customerStatuses = new Set<CustomerStatus>(['prospect', 'active', 'inactive', 'archived']);

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(status: CustomerStatus | undefined): CustomerStatus | undefined {
  if (!status) {
    return undefined;
  }

  return customerStatuses.has(status) ? status : 'prospect';
}

function normalizeAddress(value: CustomerAddress | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  const entries = Object.entries(value).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry !== 'string') {
      return acc;
    }

    const trimmed = entry.trim();
    if (trimmed.length > 0) {
      acc[key] = trimmed;
    }

    return acc;
  }, {});

  return entries;
}

function serializeAddress(value: unknown): CustomerAddress | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.entries(value).reduce<CustomerAddress>((acc, [key, entry]) => {
    if (typeof entry === 'string') {
      (acc as Record<string, string>)[key] = entry;
    }
    return acc;
  }, {});
}

export class WorkspaceCustomersService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async listCustomers(input: { workspaceId: string; userId: string; search?: string; status?: CustomerStatus }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const where = this.buildCustomerWhere(input);
    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
    });

    return customers.map((customer) => this.serializeCustomer(customer));
  }

  public async listCustomersPage(input: {
    workspaceId: string;
    userId: string;
    search?: string;
    status?: CustomerStatus;
    limit?: number;
    cursor?: string;
  }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const take = Math.min(Math.max(input.limit ?? 80, 1), 200);
    const where = this.buildCustomerWhere(input);
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        take: take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {})
      }),
      this.prisma.customer.count({ where })
    ]);

    const pageItems = customers.slice(0, take);
    const trailing = customers[take];

    return {
      items: pageItems.map((customer) => this.serializeCustomer(customer)),
      total,
      totalCount: total,
      nextCursor: trailing?.id ?? null,
      hasMore: Boolean(trailing)
    };
  }

  public async createCustomer(input: { workspaceId: string; userId: string; payload: CustomerPayload }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const name = input.payload.name.trim();
    if (name.length < 2) {
      throw new AppError('Customer name must have at least 2 characters', 422);
    }

    const sourceWorkItemId = normalizeNullableText(input.payload.sourceWorkItemId);
    if (sourceWorkItemId) {
      const sourceItem = await this.prisma.item.findFirst({
        where: { id: sourceWorkItemId, workspaceId: input.workspaceId },
        select: { id: true }
      });

      if (!sourceItem) {
        throw new AppError('Source work item not found', 404);
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        workspaceId: input.workspaceId,
        name,
        tradeName: normalizeNullableText(input.payload.tradeName),
        legalName: normalizeNullableText(input.payload.legalName),
        document: normalizeNullableText(input.payload.document),
        stateRegistration: normalizeNullableText(input.payload.stateRegistration),
        municipalRegistration: normalizeNullableText(input.payload.municipalRegistration),
        taxRegime: normalizeNullableText(input.payload.taxRegime),
        email: normalizeNullableText(input.payload.email)?.toLowerCase(),
        phone: normalizeNullableText(input.payload.phone),
        website: normalizeNullableText(input.payload.website),
        logoUrl: normalizeNullableText(input.payload.logoUrl),
        address: normalizeAddress(input.payload.address),
        status: normalizeStatus(input.payload.status) ?? 'prospect',
        notes: normalizeNullableText(input.payload.notes),
        createdBy: input.userId,
        updatedBy: input.userId
      }
    });

    await this.eventPublisher.publish({
      id: randomUUID(),
      name: DomainEventNames.CustomerCreated,
      aggregateType: 'customer',
      aggregateId: customer.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        customerId: customer.id,
        sourceWorkItemId,
        requestedBy: input.userId
      }
    });

    if (sourceWorkItemId) {
      await this.eventPublisher.publish({
        id: randomUUID(),
        name: DomainEventNames.CustomerCreatedFromWorkItem,
        aggregateType: 'customer',
        aggregateId: customer.id,
        occurredAt: new Date(),
        payload: {
          workspaceId: input.workspaceId,
          customerId: customer.id,
          sourceWorkItemId,
          requestedBy: input.userId
        }
      });
    }

    return this.serializeCustomer(customer);
  }

  public async updateCustomer(input: {
    workspaceId: string;
    customerId: string;
    userId: string;
    payload: Partial<CustomerPayload>;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.customer.findFirst({
      where: { id: input.customerId, workspaceId: input.workspaceId }
    });

    if (!current) {
      throw new AppError('Customer not found', 404);
    }

    const customer = await this.prisma.customer.update({
      where: { id: current.id },
      data: {
        name: input.payload.name?.trim(),
        tradeName: normalizeNullableText(input.payload.tradeName),
        legalName: normalizeNullableText(input.payload.legalName),
        document: normalizeNullableText(input.payload.document),
        stateRegistration: normalizeNullableText(input.payload.stateRegistration),
        municipalRegistration: normalizeNullableText(input.payload.municipalRegistration),
        taxRegime: normalizeNullableText(input.payload.taxRegime),
        email: normalizeNullableText(input.payload.email)?.toLowerCase(),
        phone: normalizeNullableText(input.payload.phone),
        website: normalizeNullableText(input.payload.website),
        logoUrl: normalizeNullableText(input.payload.logoUrl),
        address: normalizeAddress(input.payload.address),
        status: normalizeStatus(input.payload.status),
        notes: normalizeNullableText(input.payload.notes),
        updatedBy: input.userId
      }
    });

    return this.serializeCustomer(customer);
  }

  public async convertWorkItemToCustomer(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: {
      customerId?: string;
      customer?: CustomerPayload;
      fields?: Record<string, unknown>;
      customFieldValues?: Record<string, unknown>;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const converted = await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findFirst({
        where: { id: input.itemId, workspaceId: input.workspaceId },
        select: {
          id: true,
          title: true,
          fields: true,
          metadata: true,
          createdBy: true,
          updatedBy: true
        }
      });

      if (!item) {
        throw new AppError('Work item not found', 404);
      }

      const customer = input.payload.customerId
        ? await tx.customer.findFirst({
            where: { id: input.payload.customerId, workspaceId: input.workspaceId }
          })
        : input.payload.customer
          ? await tx.customer.create({
              data: {
                workspaceId: input.workspaceId,
                name: input.payload.customer.name.trim(),
                tradeName: normalizeNullableText(input.payload.customer.tradeName),
                legalName: normalizeNullableText(input.payload.customer.legalName),
                document: normalizeNullableText(input.payload.customer.document),
                stateRegistration: normalizeNullableText(input.payload.customer.stateRegistration),
                municipalRegistration: normalizeNullableText(input.payload.customer.municipalRegistration),
                taxRegime: normalizeNullableText(input.payload.customer.taxRegime),
                email: normalizeNullableText(input.payload.customer.email)?.toLowerCase(),
                phone: normalizeNullableText(input.payload.customer.phone),
                website: normalizeNullableText(input.payload.customer.website),
                logoUrl: normalizeNullableText(input.payload.customer.logoUrl),
                address: normalizeAddress(input.payload.customer.address),
                status: normalizeStatus(input.payload.customer.status) ?? 'prospect',
                notes: normalizeNullableText(input.payload.customer.notes),
                createdBy: input.userId,
                updatedBy: input.userId
              }
            })
          : null;

      if (!customer) {
        throw new AppError('Customer not found for conversion', 404);
      }

      const currentFields = isRecord(item.fields) ? item.fields : {};
      const nextFields = {
        ...currentFields,
        ...(input.payload.fields ?? {}),
        customerId: customer.id,
        clientName: customer.tradeName ?? customer.name,
        clientLegalName: customer.legalName ?? customer.tradeName ?? customer.name,
        clientDocument: customer.document ?? undefined,
        contactEmail: currentFields.contactEmail ?? customer.email ?? undefined,
        contactPhone: currentFields.contactPhone ?? customer.phone ?? undefined,
        converted: true,
        convertedAt: new Date().toISOString()
      };
      const nextMetadata = {
        ...(isRecord(item.metadata) ? item.metadata : {}),
        customerConversion: {
          customerId: customer.id,
          convertedAt: new Date().toISOString(),
          convertedBy: input.userId
        }
      };

      await tx.item.update({
        where: { id: item.id },
        data: {
          fields: nextFields as Prisma.InputJsonValue,
          metadata: nextMetadata as Prisma.InputJsonValue,
          updatedBy: input.userId
        }
      });

      await this.syncWorkItemCustomFieldsBySlug(tx, {
        workspaceId: input.workspaceId,
        itemId: item.id,
        updatedBy: input.userId,
        valuesBySlug: nextFields,
        valuesByFieldId: input.payload.customFieldValues ?? {}
      });

      const createdCustomer = !input.payload.customerId;
      if (createdCustomer) {
        await this.eventPublisher.publishInTransaction({
          id: randomUUID(),
          name: DomainEventNames.CustomerCreated,
          aggregateType: 'customer',
          aggregateId: customer.id,
          occurredAt: new Date(),
          payload: {
            workspaceId: input.workspaceId,
            customerId: customer.id,
            sourceWorkItemId: item.id,
            requestedBy: input.userId
          }
        }, tx);

        await this.eventPublisher.publishInTransaction({
          id: randomUUID(),
          name: DomainEventNames.CustomerCreatedFromWorkItem,
          aggregateType: 'customer',
          aggregateId: customer.id,
          occurredAt: new Date(),
          payload: {
            workspaceId: input.workspaceId,
            customerId: customer.id,
            sourceWorkItemId: item.id,
            requestedBy: input.userId
          }
        }, tx);
      }

      await this.eventPublisher.publishInTransaction({
        id: randomUUID(),
        name: DomainEventNames.CommercialWorkItemConvertedToCustomer,
        aggregateType: 'item',
        aggregateId: item.id,
        occurredAt: new Date(),
        payload: {
          workspaceId: input.workspaceId,
          itemId: item.id,
          customerId: customer.id,
          createdCustomer,
          requestedBy: input.userId
        }
      }, tx);

      return customer;
    });

    return this.serializeCustomer(converted);
  }

  private serializeCustomer(customer: {
    id: string;
    workspaceId: string;
    name: string;
    tradeName: string | null;
    legalName: string | null;
    document: string | null;
    stateRegistration: string | null;
    municipalRegistration: string | null;
    taxRegime: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    logoUrl: string | null;
    address: unknown;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: customer.id,
      workspaceId: customer.workspaceId,
      name: customer.name,
      tradeName: customer.tradeName ?? undefined,
      legalName: customer.legalName ?? undefined,
      document: customer.document ?? undefined,
      stateRegistration: customer.stateRegistration ?? undefined,
      municipalRegistration: customer.municipalRegistration ?? undefined,
      taxRegime: customer.taxRegime ?? undefined,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      website: customer.website ?? undefined,
      logoUrl: customer.logoUrl ?? undefined,
      address: serializeAddress(customer.address),
      status: customerStatuses.has(customer.status as CustomerStatus) ? (customer.status as CustomerStatus) : 'prospect',
      notes: customer.notes ?? undefined,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }

  private buildCustomerWhere(input: {
    workspaceId: string;
    search?: string;
    status?: CustomerStatus;
  }): Prisma.CustomerWhereInput {
    const search = input.search?.trim();
    return {
      workspaceId: input.workspaceId,
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { tradeName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { document: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    };
  }

  private async syncWorkItemCustomFieldsBySlug(
    prisma: PrismaClient | Prisma.TransactionClient,
    input: {
      workspaceId: string;
      itemId: string;
      updatedBy: string;
      valuesBySlug: Record<string, unknown>;
      valuesByFieldId: Record<string, unknown>;
    }
  ) {
    const slugs = Object.keys(input.valuesBySlug).filter((slug) => input.valuesBySlug[slug] !== undefined);
    const fields = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { slug: { in: slugs } },
          { id: { in: Object.keys(input.valuesByFieldId) } }
        ]
      },
      select: { id: true, slug: true }
    });

    await Promise.all(fields.map((field) => {
      const value = input.valuesByFieldId[field.id] ?? input.valuesBySlug[field.slug];
      if (value === undefined) {
        return Promise.resolve();
      }

      return prisma.customFieldValue.upsert({
        where: {
          fieldId_itemId: {
            fieldId: field.id,
            itemId: input.itemId
          }
        },
        create: {
          fieldId: field.id,
          itemId: input.itemId,
          value: value as Prisma.InputJsonValue,
          updatedBy: input.updatedBy
        },
        update: {
          value: value as Prisma.InputJsonValue,
          updatedBy: input.updatedBy
        }
      });
    }));
  }
}
