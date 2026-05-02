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

    const search = input.search?.trim();
    const customers = await this.prisma.customer.findMany({
      where: {
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
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
    });

    return customers.map((customer) => this.serializeCustomer(customer));
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
}
