import type { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppError } from '@/core/errors/app-error';
import {
  automationRuleSpecSchema,
  matchesConditions,
  type AutomationAction,
  type AutomationEventContext,
  type AutomationRuleSpec
} from '@/modules/automation/application/rule-schema';
import { getCommercialDocumentTemplate } from '@/modules/automation/application/commercial-document-templates';

export type QueuedAutomationEvent = {
  eventId?: string;
  eventName: string;
  workspaceId: string;
  payload: Record<string, unknown>;
};

type AutomationDocumentKind = 'wiki' | 'proposal' | 'contract';

type AutomationItemSnapshot = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  fields: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdBy: string;
  updatedBy: string | null;
  assigneeId: string | null;
  assignee: { name: string } | null;
  creator: { name: string } | null;
  customFieldValues: Array<{
    value: Prisma.JsonValue;
    field: {
      slug: string;
      variableKey: string | null;
      name: string;
    };
  }>;
};

type AutomationCustomerSnapshot = {
  id: string;
  name: string;
  tradeName: string | null;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  address: Prisma.JsonValue | null;
  status: string;
};

type AutomationCatalogItemSnapshot = {
  id: string;
  kind: string;
  billingType: string;
  recurringInterval: string | null;
  recurringIntervalCount: number | null;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  metadata: Prisma.JsonValue | null;
};

type AutomationCustomerPayload = {
  name: string;
  tradeName: string | null;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  status: 'prospect' | 'active' | 'inactive' | 'archived';
};

function interpolateDocumentContent(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    const resolved = variables[key];
    return typeof resolved === 'string' && resolved.length > 0 ? resolved : '';
  });
}

function normalizeDocumentValidations(
  kind: AutomationDocumentKind,
  validations: string[] | undefined
): string[] | undefined {
  if (kind !== 'proposal' || !validations) {
    return validations;
  }

  const filtered = validations.filter((validation) => validation !== 'commercial.proposal.required_fields');
  return filtered.length > 0 ? filtered : undefined;
}

function toSlug(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date().toLocaleDateString('pt-BR');
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('pt-BR');
  }

  return date.toLocaleDateString('pt-BR');
}

function formatMoney(value: unknown): string {
  const amount = readNumber(value);
  if (amount === undefined) {
    return '';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount);
}

function formatMoneyFromCents(value: unknown, currency = 'BRL'): string {
  const amount = readNumber(value);
  if (amount === undefined) {
    return '';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount / 100);
}

function formatAddress(value: unknown): string {
  if (!isRecord(value)) {
    return '';
  }

  return [
    [value.street, value.number].map(readString).filter(Boolean).join(', '),
    readString(value.complement),
    readString(value.district),
    [value.city, value.state].map(readString).filter(Boolean).join(' / '),
    readString(value.zipCode),
    readString(value.country)
  ]
    .filter(Boolean)
    .join(' - ');
}

function parseRuleSpecOrThrow(rule: {
  id: string;
  trigger: Prisma.JsonValue;
  conditions: Prisma.JsonValue | null;
  actions: Prisma.JsonValue;
}): AutomationRuleSpec {
  const parsed = automationRuleSpecSchema.safeParse({
    trigger: rule.trigger,
    conditions: rule.conditions ?? undefined,
    actions: rule.actions
  });

  if (!parsed.success) {
    throw new AppError('Invalid persisted automation rule specification.', 500, {
      ruleId: rule.id,
      issues: parsed.error.flatten()
    });
  }

  return parsed.data;
}

function toContext(
  workspaceId: string,
  payload: Record<string, unknown>
): AutomationEventContext {
  const readString = (key: string): string | undefined => {
    const value = payload[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };

  const readNumber = (key: string): number | undefined => {
    const value = payload[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };

  return {
    workspaceId,
    itemId:
      readString('itemId') ??
      (payload.linkedEntityType === 'work_item' ? readString('linkedEntityId') : undefined),
    sourceViewId: readString('sourceViewId'),
    sourceViewKey: readString('sourceViewKey'),
    fromColumnId: readString('fromColumnId'),
    fromColumnKey: readString('fromColumnKey'),
    toViewId: readString('toViewId'),
    toViewKey: readString('toViewKey'),
    toColumnId: readString('toColumnId'),
    toColumnKey: readString('toColumnKey'),
    itemTypeId: readString('itemTypeId'),
    itemTypeSlug: readString('itemTypeSlug'),
    status: readString('status'),
    assigneeId: readString('assigneeId'),
    priority: readNumber('priority')
  };
}

export class AutomationRuntimeService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly ensureDefaultViews?: (workspaceId: string) => Promise<void>
  ) {}

  public async processEvent(event: QueuedAutomationEvent): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        workspaceId: event.workspaceId,
        enabled: true,
        triggerType: event.eventName
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }]
    });

    if (rules.length === 0) {
      return;
    }

    for (const rule of rules) {
      await this.executeRuleAgainstEvent(rule, event);
    }
  }

  public async runRule(input: {
    ruleId: string;
    context: Record<string, unknown>;
    requestedBy?: string;
  }): Promise<void> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: input.ruleId }
    });

    if (!rule) {
      throw new AppError('Automation rule not found.', 404);
    }

    await this.executeRuleAgainstEvent(rule, {
      eventName: 'manual',
      workspaceId: rule.workspaceId,
      payload: {
        ...input.context,
        requestedBy: input.requestedBy ?? input.context.requestedBy
      }
    });
  }

  private async executeRuleAgainstEvent(
    rule: {
      id: string;
      workspaceId: string;
      trigger: Prisma.JsonValue;
      conditions: Prisma.JsonValue | null;
      actions: Prisma.JsonValue;
    },
    event: QueuedAutomationEvent
  ): Promise<void> {
    if (event.eventId) {
      const duplicate = await this.prisma.automationExecution.findFirst({
        where: {
          ruleId: rule.id,
          eventId: event.eventId,
          status: {
            in: ['succeeded', 'failed', 'skipped']
          }
        },
        select: { id: true }
      });

      if (duplicate) {
        return;
      }
    }

    const execution = await this.prisma.automationExecution.create({
      data: {
        workspaceId: rule.workspaceId,
        ruleId: rule.id,
        eventName: event.eventName,
        eventId: event.eventId,
        status: 'running',
        attempts: 1,
        startedAt: new Date(),
        context: toJsonValue(event.payload)
      }
    });

    try {
      const spec = parseRuleSpecOrThrow(rule);
      const context = toContext(rule.workspaceId, event.payload);

      if (!matchesConditions(spec.conditions, context)) {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'skipped',
            finishedAt: new Date()
          }
        });
        return;
      }

      for (const action of spec.actions) {
        await this.executeAction(action, context, event.payload);
      }

      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date()
        }
      });
    } catch (error) {
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown automation runtime error.'
        }
      });

      throw error;
    }
  }

  private async executeAction(
    action: AutomationAction,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;

    if (!itemId) {
      throw new AppError('Automation event does not include itemId.', 422);
    }

    if (!context.workspaceId) {
      throw new AppError('Automation event does not include workspaceId.', 422);
    }

    switch (action.type) {
      case 'set_view_column': {
        if (this.ensureDefaultViews) {
          await this.ensureDefaultViews(context.workspaceId);
        }

        const view = await this.resolveView({
          workspaceId: context.workspaceId,
          viewId: action.targetViewId,
          viewKey: action.targetViewKey
        });

        const column = await this.resolveColumn({
          workspaceId: context.workspaceId,
          viewId: view.id,
          columnId: action.targetColumnId,
          columnKey: action.targetColumnKey
        });

        await this.prisma.workItemViewPlacement.upsert({
          where: {
            itemId_viewId: {
              itemId,
              viewId: view.id
            }
          },
          create: {
            workspaceId: context.workspaceId,
            itemId,
            viewId: view.id,
            columnId: column.id,
            position: action.position ?? 0,
            metadata:
              action.metadata !== undefined
                ? toJsonValue(action.metadata)
                : ((rawPayload.metadata as Prisma.InputJsonValue | undefined) ?? undefined),
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : null
          },
          update: {
            columnId: column.id,
            position: action.position,
            metadata:
              action.metadata !== undefined
                ? toJsonValue(action.metadata)
                : undefined,
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : null
          }
        });

        await this.syncItemBoardPositionFromViewColumn({
          workspaceId: context.workspaceId,
          itemId,
          columnKey: column.key ?? action.targetColumnKey ?? '',
          columnName: column.name ?? action.targetColumnKey ?? '',
          requestedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : null
        });
        return;
      }

      case 'remove_from_view': {
        if (this.ensureDefaultViews) {
          await this.ensureDefaultViews(context.workspaceId);
        }

        const view = await this.resolveView({
          workspaceId: context.workspaceId,
          viewId: action.targetViewId,
          viewKey: action.targetViewKey
        });

        await this.prisma.workItemViewPlacement.deleteMany({
          where: {
            workspaceId: context.workspaceId,
            itemId,
            viewId: view.id
          }
        });
        return;
      }

      case 'set_work_item_state': {
        let statusToSet: string | undefined = action.status;
        let stateIdToSet: string | undefined = action.stateId;
        let boardColumnIdToSet: string | undefined;

        if (!stateIdToSet && action.stateSlug) {
          const state = await this.prisma.workflowState.findFirst({
            where: {
              workspaceId: context.workspaceId,
              slug: action.stateSlug.trim().toLowerCase()
            },
            select: {
              id: true,
              slug: true
            }
          });

          if (!state) {
            throw new AppError('Target workflow state not found.', 404);
          }

          stateIdToSet = state.id;
          if (!statusToSet) {
            statusToSet = state.slug;
          }
        }

        if (stateIdToSet) {
          const mapping = this.prisma.columnStateMapping
            ? await this.prisma.columnStateMapping.findFirst({
                where: {
                  workspaceId: context.workspaceId,
                  stateId: stateIdToSet
                },
                orderBy: [{ position: 'asc' }],
                include: {
                  column: {
                    select: {
                      id: true,
                      isActive: true
                    }
                  }
                }
              })
            : null;

          if (mapping?.column?.isActive) {
            boardColumnIdToSet = mapping.column.id;
          }
        }

        await this.prisma.item.update({
          where: { id: itemId },
          data: {
            stateId: stateIdToSet,
            status: statusToSet,
            boardColumnId: boardColumnIdToSet,
            columnId: boardColumnIdToSet,
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : undefined
          }
        });
        return;
      }

      case 'create_document': {
        await this.createLinkedDocumentFromWorkItem(action, context, rawPayload);
        return;
      }

      case 'update_document_status': {
        await this.updateLinkedDocumentStatus(action, context, rawPayload);
        return;
      }

      case 'create_billing_order': {
        await this.prepareBillingOrder(action, context, rawPayload);
        return;
      }

      case 'ensure_customer_from_work_item': {
        await this.ensureCustomerFromWorkItem(action, context, rawPayload);
        return;
      }

      default:
        throw new AppError('Unsupported automation action type.', 422);
    }
  }

  private async createLinkedDocumentFromWorkItem(
    action: Extract<AutomationAction, { type: 'create_document' }>,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;
    const workspaceId = context.workspaceId;
    if (!itemId || !workspaceId) {
      throw new AppError('Automation event does not include work item context.', 422);
    }

    const item = await this.loadItemForAutomation(workspaceId, itemId);
    const customer = await this.loadCustomerForItem(workspaceId, item);
    const catalogItem = await this.loadCatalogItemForItem(workspaceId, item);

    await this.validateCommercialRequirements({
      validations: normalizeDocumentValidations(action.kind, action.validations),
      item,
      customer,
      catalogItem
    });

    const kind = action.kind;
    const existing = await this.findLinkedDocument(workspaceId, itemId, kind);
    const targetFieldSlug = action.targetFieldSlug ?? (kind === 'proposal' ? 'proposalId' : kind === 'contract' ? 'contractId' : undefined);

    if (existing) {
      if (targetFieldSlug) {
        await this.writeWorkItemField({
          workspaceId,
          itemId,
          fieldSlug: targetFieldSlug,
          value: existing.id,
          updatedBy: readString(rawPayload.requestedBy) ?? item.updatedBy ?? item.createdBy
        });
      }
      return;
    }

    const template = getCommercialDocumentTemplate(kind);
    const position = await this.prisma.workspaceDocument.count({
      where: { workspaceId }
    });
    const variables = await this.buildDocumentVariables({
      workspaceId,
      item,
      customer,
      catalogItem,
      kind,
      documentCount: position + 1
    });
    const createdBy = readString(rawPayload.requestedBy) ?? item.updatedBy ?? item.createdBy;
    const title = action.title ?? `${template.title} - ${variables.clientName || item.title}`;
    const metadata = {
      ...(template.metadata ?? {}),
      ...variables,
      ...(action.metadata ?? {}),
      status: action.status ?? readString(action.metadata?.status) ?? readString(template.metadata?.status) ?? 'draft',
      automationBinding: action.binding,
      automationGenerated: true,
      generatedFromWorkItemId: itemId,
      ...(kind === 'proposal' ? { publicToken: randomUUID() } : {})
    };

    const document = await this.prisma.workspaceDocument.create({
      data: {
        workspaceId,
        title,
        content: interpolateDocumentContent(template.content, variables),
        kind,
        linkedEntityType: 'work_item',
        linkedEntityId: itemId,
        tags: [kind === 'proposal' ? 'Proposta' : kind === 'contract' ? 'Contrato' : 'Wiki'],
        metadata: toJsonValue(metadata),
        position,
        createdBy,
        updatedBy: createdBy
      }
    });

    await this.prisma.workItemDocumentLink.upsert({
      where: {
        itemId_documentId: {
          itemId,
          documentId: document.id
        }
      },
      create: {
        workspaceId,
        itemId,
        documentId: document.id,
        linkedBy: createdBy
      },
      update: {
        linkedBy: createdBy
      }
    });

    if (targetFieldSlug) {
      await this.writeWorkItemField({
        workspaceId,
        itemId,
        fieldSlug: targetFieldSlug,
        value: document.id,
        updatedBy: createdBy
      });
    }
  }

  private async updateLinkedDocumentStatus(
    action: Extract<AutomationAction, { type: 'update_document_status' }>,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;
    const workspaceId = context.workspaceId;
    if (!itemId || !workspaceId) {
      throw new AppError('Automation event does not include work item context.', 422);
    }

    const item = await this.loadItemForAutomation(workspaceId, itemId);
    const customer = await this.loadCustomerForItem(workspaceId, item);
    const catalogItem = await this.loadCatalogItemForItem(workspaceId, item);
    await this.validateCommercialRequirements({
      validations: action.validations,
      item,
      customer,
      catalogItem
    });

    const document = await this.findLinkedDocument(workspaceId, itemId, action.kind);
    if (!document) {
      throw new AppError('Linked document not found for automation.', 404);
    }

    await this.prisma.workspaceDocument.update({
      where: { id: document.id },
      data: {
        metadata: toJsonValue({
          ...(isRecord(document.metadata) ? document.metadata : {}),
          ...(action.metadata ?? {}),
          status: action.status,
          statusUpdatedByAutomation: true,
          statusUpdatedAt: new Date().toISOString()
        }),
        updatedBy: readString(rawPayload.requestedBy) ?? item.updatedBy ?? item.createdBy
      }
    });
  }

  private async prepareBillingOrder(
    action: Extract<AutomationAction, { type: 'create_billing_order' }>,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;
    const workspaceId = context.workspaceId;
    if (!itemId || !workspaceId) {
      throw new AppError('Automation event does not include work item context.', 422);
    }

    const item = await this.loadItemForAutomation(workspaceId, itemId);
    const customer = await this.loadCustomerForItem(workspaceId, item);
    const catalogItem = await this.loadCatalogItemForItem(workspaceId, item);
    await this.validateCommercialRequirements({
      validations: action.validations,
      item,
      customer,
      catalogItem
    });

    const billingOrderId = `BILL-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const updatedBy = readString(rawPayload.requestedBy) ?? item.updatedBy ?? item.createdBy;

    await this.writeWorkItemField({
      workspaceId,
      itemId,
      fieldSlug: action.targetFieldSlug ?? 'billingOrderId',
      value: billingOrderId,
      updatedBy
    });

    const currentMetadata = isRecord(item.metadata) ? item.metadata : {};
    await this.prisma.item.update({
      where: { id: itemId },
      data: {
        metadata: toJsonValue({
          ...currentMetadata,
          commercialBilling: {
            ...(isRecord(currentMetadata.commercialBilling) ? currentMetadata.commercialBilling : {}),
            billingOrderId,
            requestedAt: new Date().toISOString(),
            requestedBy: updatedBy,
            ...(action.metadata ?? {})
          }
        }),
        updatedBy
      }
    });
  }

  private async ensureCustomerFromWorkItem(
    action: Extract<AutomationAction, { type: 'ensure_customer_from_work_item' }>,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;
    const workspaceId = context.workspaceId;
    if (!itemId || !workspaceId) {
      throw new AppError('Automation event does not include work item context.', 422);
    }

    const item = await this.loadItemForAutomation(workspaceId, itemId);
    const updatedBy = readString(rawPayload.requestedBy) ?? item.updatedBy ?? item.createdBy;
    const targetFieldSlug = action.targetFieldSlug ?? 'customerId';

    const linkedCustomer = await this.loadCustomerForItem(workspaceId, item);
    if (linkedCustomer) {
      if (linkedCustomer.status !== action.status) {
        await this.prisma.customer.update({
          where: { id: linkedCustomer.id },
          data: {
            status: action.status,
            updatedBy
          }
        });
      }

      await this.writeWorkItemField({
        workspaceId,
        itemId,
        fieldSlug: targetFieldSlug,
        value: linkedCustomer.id,
        updatedBy
      });
      return;
    }

    const customerPayload = this.buildCustomerPayloadFromItem(item, action.status);
    const matchedCustomer = await this.findMatchingCustomerForWorkItem(workspaceId, customerPayload);

    const customer = matchedCustomer
      ? await this.updateMatchedCustomerFromWorkItem(matchedCustomer, customerPayload, updatedBy)
      : await this.prisma.customer.create({
          data: {
            workspaceId,
            name: customerPayload.name,
            tradeName: customerPayload.tradeName,
            legalName: customerPayload.legalName,
            document: customerPayload.document,
            email: customerPayload.email,
            phone: customerPayload.phone,
            website: customerPayload.website,
            logoUrl: customerPayload.logoUrl,
            status: customerPayload.status,
            notes: `Criado automaticamente a partir do work item ${item.title}.`,
            createdBy: updatedBy,
            updatedBy
          },
          select: { id: true }
        });

    await this.writeWorkItemField({
      workspaceId,
      itemId,
      fieldSlug: targetFieldSlug,
      value: customer.id,
      updatedBy
    });
  }

  private buildCustomerPayloadFromItem(
    item: AutomationItemSnapshot,
    status: 'prospect' | 'active' | 'inactive' | 'archived'
  ): AutomationCustomerPayload {
    const clientName = this.readItemField(item, ['clientName']);
    const companyName = this.readItemField(item, ['companyName']);
    const contactName = this.readItemField(item, ['contactName']);
    const name = clientName || companyName || contactName || item.title;

    if (name.trim().length < 2) {
      throw new AppError('Nao foi possivel criar o cliente automaticamente. Preencha Nome do cliente, Empresa ou Nome do contato.', 422);
    }

    const email = this.readItemField(item, ['contactEmail', 'email']).toLowerCase() || null;
    const document = this.readItemField(item, ['clientDocument', 'customerDocument', 'document', 'cnpj', 'cpf']) || null;
    const phone = this.readItemField(item, ['contactPhone', 'phone']) || null;
    const website = this.readItemField(item, ['clientWebsite', 'website']) || null;
    const logoUrl = this.readItemField(item, ['clientLogoUrl', 'logoUrl']) || null;

    return {
      name: name.trim(),
      tradeName: companyName || null,
      legalName: clientName && clientName !== companyName ? clientName : null,
      document,
      email,
      phone,
      website,
      logoUrl,
      status
    };
  }

  private async findMatchingCustomerForWorkItem(
    workspaceId: string,
    payload: AutomationCustomerPayload
  ) {
    const or: Prisma.CustomerWhereInput[] = [];

    if (payload.document) {
      or.push({ document: payload.document });
    }

    if (payload.email) {
      or.push({ email: payload.email });
    }

    if (payload.name) {
      or.push(
        { name: { equals: payload.name, mode: 'insensitive' } },
        { tradeName: { equals: payload.name, mode: 'insensitive' } },
        { legalName: { equals: payload.name, mode: 'insensitive' } }
      );
    }

    if (or.length === 0) {
      return null;
    }

    return this.prisma.customer.findFirst({
      where: {
        workspaceId,
        OR: or
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        tradeName: true,
        legalName: true,
        document: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        status: true
      }
    });
  }

  private async updateMatchedCustomerFromWorkItem(
    customer: {
      id: string;
      name: string;
      tradeName: string | null;
      legalName: string | null;
      document: string | null;
      email: string | null;
      phone: string | null;
      website: string | null;
      logoUrl: string | null;
      status: string;
    },
    payload: AutomationCustomerPayload,
    updatedBy: string
  ): Promise<{ id: string }> {
    const data: Prisma.CustomerUpdateInput = {
      status: payload.status,
      updatedBy
    };

    if (!customer.tradeName && payload.tradeName) data.tradeName = payload.tradeName;
    if (!customer.legalName && payload.legalName) data.legalName = payload.legalName;
    if (!customer.document && payload.document) data.document = payload.document;
    if (!customer.email && payload.email) data.email = payload.email;
    if (!customer.phone && payload.phone) data.phone = payload.phone;
    if (!customer.website && payload.website) data.website = payload.website;
    if (!customer.logoUrl && payload.logoUrl) data.logoUrl = payload.logoUrl;

    return this.prisma.customer.update({
      where: { id: customer.id },
      data,
      select: { id: true }
    });
  }

  private async loadItemForAutomation(workspaceId: string, itemId: string): Promise<AutomationItemSnapshot> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        workspaceId
      },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        description: true,
        fields: true,
        metadata: true,
        createdBy: true,
        updatedBy: true,
        assigneeId: true,
        assignee: {
          select: {
            name: true
          }
        },
        creator: {
          select: {
            name: true
          }
        },
        customFieldValues: {
          select: {
            value: true,
            field: {
              select: {
                slug: true,
                variableKey: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!item) {
      throw new AppError('Work item not found for automation.', 404);
    }

    return item;
  }

  private async loadCustomerForItem(
    workspaceId: string,
    item: AutomationItemSnapshot
  ): Promise<AutomationCustomerSnapshot | null> {
    const customerId = this.readItemField(item, ['customerId']);
    if (!customerId) {
      return null;
    }

    return this.prisma.customer.findFirst({
      where: {
        id: customerId,
        workspaceId
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        legalName: true,
        document: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        address: true,
        status: true
      }
    });
  }

  private async loadCatalogItemForItem(
    workspaceId: string,
    item: AutomationItemSnapshot
  ): Promise<AutomationCatalogItemSnapshot | null> {
    const catalogItemId = this.readItemField(item, ['catalogItemId', 'interest']);
    if (!catalogItemId) {
      return null;
    }

    return (this.prisma as unknown as {
      connectCatalogItem: {
        findFirst(input: {
          where: {
            id: string;
            workspaceId: string;
          };
          select: Record<string, boolean>;
        }): Promise<AutomationCatalogItemSnapshot | null>;
      };
    }).connectCatalogItem.findFirst({
      where: {
        id: catalogItemId,
        workspaceId
      },
      select: {
        id: true,
        kind: true,
        billingType: true,
        recurringInterval: true,
        recurringIntervalCount: true,
        name: true,
        description: true,
        amount: true,
        currency: true,
        metadata: true
      }
    });
  }

  private async findLinkedDocument(
    workspaceId: string,
    itemId: string,
    kind: AutomationDocumentKind
  ) {
    return this.prisma.workspaceDocument.findFirst({
      where: {
        workspaceId,
        kind,
        OR: [
          {
            linkedEntityType: 'work_item',
            linkedEntityId: itemId
          },
          {
            itemLinks: {
              some: {
                workspaceId,
                itemId
              }
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        metadata: true
      }
    });
  }

  private readItemField(item: AutomationItemSnapshot, keys: string[]): string {
    const fields = isRecord(item.fields) ? item.fields : {};

    for (const key of keys) {
      const direct = readString(fields[key]);
      if (direct) {
        return direct;
      }
    }

    for (const value of item.customFieldValues) {
      if (keys.includes(value.field.slug) || (value.field.variableKey && keys.includes(value.field.variableKey))) {
        const resolved = readString(value.value);
        if (resolved) {
          return resolved;
        }
      }
    }

    return '';
  }

  private readItemNumberField(item: AutomationItemSnapshot, keys: string[]): number | undefined {
    const fields = isRecord(item.fields) ? item.fields : {};

    for (const key of keys) {
      const direct = readNumber(fields[key]);
      if (direct !== undefined) {
        return direct;
      }
    }

    for (const value of item.customFieldValues) {
      if (keys.includes(value.field.slug) || (value.field.variableKey && keys.includes(value.field.variableKey))) {
        const resolved = readNumber(value.value);
        if (resolved !== undefined) {
          return resolved;
        }
      }
    }

    return undefined;
  }

  private async buildDocumentVariables(input: {
    workspaceId: string;
    item: AutomationItemSnapshot;
    customer: AutomationCustomerSnapshot | null;
    catalogItem: AutomationCatalogItemSnapshot | null;
    kind: AutomationDocumentKind;
    documentCount: number;
  }): Promise<Record<string, string>> {
    const fieldVariables = input.item.customFieldValues.reduce<Record<string, string>>((acc, entry) => {
      const raw = readString(entry.value);
      if (!raw) {
        return acc;
      }

      if (entry.field.variableKey) {
        acc[entry.field.variableKey] = raw;
      }

      acc[entry.field.slug] = raw;
      return acc;
    }, {});
    const catalogMetadata = isRecord(input.catalogItem?.metadata) ? input.catalogItem.metadata : {};
    const catalogMetadataText = (key: string): string => readString(catalogMetadata[key]) ?? '';
    const catalogAmount = input.catalogItem ? input.catalogItem.amount / 100 : undefined;
    const dealValueRaw = this.readItemNumberField(input.item, ['estimatedValue', 'dealValue', 'value']) ?? catalogAmount;
    const clientName =
      input.customer?.tradeName ??
      input.customer?.legalName ??
      input.customer?.name ??
      this.readItemField(input.item, ['clientName', 'companyName', 'contactName']);
    const proposalPrefix = input.kind === 'proposal' ? 'PROP' : 'CTR';
    const clientAddress = formatAddress(input.customer?.address) || this.readItemField(input.item, ['clientAddress']);
    const catalogScope = catalogMetadataText('scope') || input.catalogItem?.description || input.catalogItem?.name || '';
    const catalogPayload = {
      id: input.catalogItem?.id ?? '',
      kind: input.catalogItem?.kind ?? '',
      billingType: input.catalogItem?.billingType ?? '',
      recurringInterval: input.catalogItem?.recurringInterval ?? '',
      recurringIntervalCount: input.catalogItem?.recurringIntervalCount ?? '',
      name: input.catalogItem?.name ?? '',
      description: input.catalogItem?.description ?? '',
      amount: input.catalogItem?.amount ?? '',
      currency: input.catalogItem?.currency ?? '',
      metadata: catalogMetadata
    };
    const catalogVariables: Record<string, string> = input.catalogItem
      ? {
          catalogItemId: input.catalogItem.id,
          catalogItemName: input.catalogItem.name,
          catalogItemKind: input.catalogItem.kind,
          catalogItemBillingType: input.catalogItem.billingType,
          catalogItemRecurringInterval: input.catalogItem.recurringInterval ?? '',
          catalogItemRecurringIntervalCount: input.catalogItem.recurringIntervalCount ? String(input.catalogItem.recurringIntervalCount) : '',
          catalogItemDescription: input.catalogItem.description ?? '',
          catalogItemAmount: formatMoneyFromCents(input.catalogItem.amount, input.catalogItem.currency),
          catalogItemCurrency: input.catalogItem.currency.toUpperCase(),
          catalogItemUnit: catalogMetadataText('unit'),
          catalogItemDefaultQuantity: catalogMetadataText('defaultQuantity'),
          catalogItemScope: catalogMetadataText('scope'),
          catalogItemDeliverables: catalogMetadataText('deliverables'),
          catalogItemDeliveryTerms: catalogMetadataText('deliveryTerms'),
          catalogItemPaymentTerms: catalogMetadataText('paymentTerms'),
          catalogItemProposalValidity: catalogMetadataText('proposalValidity'),
          catalogItemContractTerm: catalogMetadataText('contractTerm'),
          catalogItemCancellationTerms: catalogMetadataText('cancellationTerms'),
          catalogItemClientResponsibilities: catalogMetadataText('clientResponsibilities'),
          catalogItemAcceptanceCriteria: catalogMetadataText('acceptanceCriteria'),
          catalogItemContractNotes: catalogMetadataText('contractNotes'),
          'workitem.catalogitem.id': input.catalogItem.id,
          'workitem.catalogitem.name': input.catalogItem.name,
          'workitem.catalogitem.kind': input.catalogItem.kind,
          'workitem.catalogitem.billingType': input.catalogItem.billingType,
          'workitem.catalogitem.amount': formatMoneyFromCents(input.catalogItem.amount, input.catalogItem.currency),
          'workitem.catalogitem.currency': input.catalogItem.currency.toUpperCase(),
          'workitem.catalogitem.description': input.catalogItem.description ?? '',
          'workitem.catalogitem.catalogpop': JSON.stringify(catalogPayload)
        }
      : {};

    return {
      ...fieldVariables,
      ...catalogVariables,
      clientLogoUrl: input.customer?.logoUrl ?? this.readItemField(input.item, ['clientLogoUrl']) ?? '',
      clientName,
      clientDocument: input.customer?.document ?? this.readItemField(input.item, ['clientDocument', 'customerDocument', 'document', 'cnpj', 'cpf']),
      clientAddress,
      ownerName: input.item.assignee?.name ?? input.item.creator?.name ?? '',
      proposalDate: formatDate(new Date()),
      proposalValidity: this.readItemField(input.item, ['proposalValidity']) || catalogMetadataText('proposalValidity') || '',
      proposalCode: `${proposalPrefix}-${new Date().getFullYear()}-${String(input.documentCount).padStart(5, '0')}`,
      dealTitle: input.item.title,
      dealDescription: input.item.description || catalogScope || this.readItemField(input.item, ['interest', 'implementationScope']) || '',
      dealValue: formatMoney(dealValueRaw),
      contactName: this.readItemField(input.item, ['contactName']),
      contactEmail: this.readItemField(input.item, ['contactEmail']),
      contactPhone: this.readItemField(input.item, ['contactPhone']),
      companyName: 'Dask',
      companyDocument: '',
      companyAddress: '',
      paymentTerms: this.readItemField(input.item, ['paymentTerms']) || catalogMetadataText('paymentTerms') || '- Forma de pagamento: a definir',
      expectedCloseDate: this.readItemField(input.item, ['expectedCloseDate']),
      implementationScope: this.readItemField(input.item, ['implementationScope']) || catalogScope || input.item.description || '',
      deliverables: catalogMetadataText('deliverables') || 'Entregaveis conforme escopo aprovado.',
      deliveryTerms: catalogMetadataText('deliveryTerms') || 'Prazo a definir entre as partes.',
      clientResponsibilities: catalogMetadataText('clientResponsibilities') || 'O cliente fornecera informacoes, acessos e aprovacoes necessarias.',
      acceptanceCriteria: catalogMetadataText('acceptanceCriteria') || 'Entrega aceita conforme validacao do escopo contratado.',
      cancellationTerms: catalogMetadataText('cancellationTerms') || 'Cancelamento conforme acordo entre as partes.',
      contractNotes: catalogMetadataText('contractNotes'),
      contractTerm: catalogMetadataText('contractTerm') || this.readItemField(input.item, ['contractDuration']),
      startDate: this.readItemField(input.item, ['contractStartDate']),
      endDate: catalogMetadataText('contractTerm') || this.readItemField(input.item, ['contractDuration']),
      city: '',
      state: ''
    };
  }

  private async validateCommercialRequirements(input: {
    validations?: string[];
    item: AutomationItemSnapshot;
    customer: AutomationCustomerSnapshot | null;
    catalogItem?: AutomationCatalogItemSnapshot | null;
  }): Promise<void> {
    const validations = input.validations ?? [];
    if (validations.length === 0) {
      return;
    }

    const missing = new Set<string>();
    const catalogMetadata = isRecord(input.catalogItem?.metadata) ? input.catalogItem.metadata : {};
    const catalogMetadataText = (key: string): string => readString(catalogMetadata[key]) ?? '';
    const hasCatalogAmount = typeof input.catalogItem?.amount === 'number' && input.catalogItem.amount > 0;
    const hasDealValue = this.readItemNumberField(input.item, ['estimatedValue', 'dealValue', 'value']) !== undefined || hasCatalogAmount;
    const hasScope =
      Boolean(this.readItemField(input.item, ['interest', 'implementationScope'])) ||
      Boolean(input.item.description) ||
      Boolean(input.catalogItem?.name) ||
      Boolean(catalogMetadataText('scope'));
    const hasPaymentTerms = Boolean(this.readItemField(input.item, ['paymentTerms'])) || Boolean(catalogMetadataText('paymentTerms'));
    const hasProposalValidity =
      Boolean(this.readItemField(input.item, ['proposalValidity'])) || Boolean(catalogMetadataText('proposalValidity'));
    const clientDocument =
      input.customer?.document ??
      this.readItemField(input.item, ['clientDocument', 'customerDocument', 'document', 'cnpj', 'cpf']);
    const clientAddress = formatAddress(input.customer?.address) || this.readItemField(input.item, ['clientAddress']);
    const hasClient =
      Boolean(input.customer) ||
      Boolean(this.readItemField(input.item, ['companyName', 'clientName', 'contactName']));

    if (validations.includes('commercial.proposal.required_fields')) {
      if (!hasClient) missing.add('Cliente');
      if (!this.readItemField(input.item, ['contactName', 'contactEmail'])) missing.add('Contato principal');
      if (!input.item.assigneeId) missing.add('Responsavel');
      if (!hasScope) {
        missing.add('Escopo/interesse');
      }
      if (!hasDealValue) {
        missing.add('Valor estimado');
      }
      if (!hasProposalValidity) missing.add('Validade da proposta');
    }

    if (validations.includes('commercial.contract.required_fields')) {
      if (!hasClient) missing.add('Cliente');
      if (!clientDocument) missing.add('Documento fiscal do cliente');
      if (!clientAddress) missing.add('Endereco do cliente');
      if (!hasScope) missing.add('Escopo/interesse');
      if (!hasDealValue) {
        missing.add('Valor');
      }
      if (!hasPaymentTerms) missing.add('Condicoes comerciais');
    }

    if (validations.includes('commercial.billing.required_fields')) {
      if (!input.customer) missing.add('Cliente');
      if (!this.readItemField(input.item, ['financialEmail', 'contactEmail']) && !input.customer?.email) {
        missing.add('E-mail financeiro');
      }
      if (!hasDealValue) {
        missing.add('Valor');
      }
      if (!this.readItemField(input.item, ['billingType'])) missing.add('Tipo de cobranca');
      if (!this.readItemField(input.item, ['dueDate', 'billingDueDate'])) missing.add('Vencimento');
    }

    if (missing.size > 0) {
      throw new AppError(`Nao foi possivel executar a automacao. Preencha: ${Array.from(missing).join(', ')}.`, 422);
    }
  }

  private async writeWorkItemField(input: {
    workspaceId: string;
    itemId: string;
    fieldSlug: string;
    value: string;
    updatedBy: string;
  }): Promise<void> {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        workspaceId: input.workspaceId,
        slug: input.fieldSlug
      },
      select: { id: true }
    });
    const item = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      },
      select: { fields: true }
    });

    const fields = isRecord(item?.fields) ? item.fields : {};
    await this.prisma.item.update({
      where: { id: input.itemId },
      data: {
        fields: toJsonValue({
          ...fields,
          [input.fieldSlug]: input.value
        }),
        updatedBy: input.updatedBy
      }
    });

    if (!field) {
      return;
    }

    await this.prisma.customFieldValue.upsert({
      where: {
        fieldId_itemId: {
          fieldId: field.id,
          itemId: input.itemId
        }
      },
      create: {
        fieldId: field.id,
        itemId: input.itemId,
        value: toJsonValue(input.value),
        updatedBy: input.updatedBy
      },
      update: {
        value: toJsonValue(input.value),
        updatedBy: input.updatedBy
      }
    });
  }

  private async resolveView(input: {
    workspaceId: string;
    viewId?: string;
    viewKey?: string;
  }) {
    if (input.viewId) {
      const byId = await this.prisma.automationView.findFirst({
        where: { id: input.viewId, workspaceId: input.workspaceId }
      });

      if (byId) {
        return byId;
      }
    }

    if (input.viewKey) {
      const normalizedKey = toSlug(input.viewKey);
      const byKey = await this.prisma.automationView.findFirst({
        where: {
          workspaceId: input.workspaceId,
          key: normalizedKey
        }
      });

      if (byKey) {
        return byKey;
      }

      const candidates = await this.prisma.automationView.findMany({
        where: { workspaceId: input.workspaceId },
        select: { id: true, key: true, name: true }
      });

      const fallback = candidates.find((view) => {
        return toSlug(view.name) === normalizedKey || toSlug(view.key) === normalizedKey;
      });

      if (fallback) {
        return fallback;
      }
    }

    throw new AppError('Target automation view not found.', 404);
  }

  private async resolveColumn(input: {
    workspaceId: string;
    viewId: string;
    columnId?: string;
    columnKey?: string;
  }) {
    if (input.columnId) {
      const byId = await this.prisma.automationViewColumn.findFirst({
        where: {
          id: input.columnId,
          workspaceId: input.workspaceId,
          viewId: input.viewId
        }
      });

      if (byId) {
        return byId;
      }
    }

    if (input.columnKey) {
      const normalizedColumnKey = toSlug(input.columnKey);

      const byKey = await this.prisma.automationViewColumn.findFirst({
        where: {
          workspaceId: input.workspaceId,
          viewId: input.viewId,
          key: normalizedColumnKey
        }
      });

      if (byKey) {
        return byKey;
      }

      const aggregate = await this.prisma.automationViewColumn.aggregate({
        where: {
          workspaceId: input.workspaceId,
          viewId: input.viewId
        },
        _max: { position: true }
      });

      const created = await this.prisma.automationViewColumn.upsert({
        where: {
          viewId_key: {
            viewId: input.viewId,
            key: normalizedColumnKey
          }
        },
        create: {
          workspaceId: input.workspaceId,
          viewId: input.viewId,
          key: normalizedColumnKey,
          name: this.humanizeColumnName(input.columnKey),
          color: '#64748b',
          position: (aggregate._max.position ?? -1) + 1,
          isActive: true
        },
        update: {
          isActive: true
        }
      });

      return created;
    }

    throw new AppError('Target automation view column not found.', 404);
  }

  private humanizeColumnName(value: string): string {
    const normalized = value
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ');

    if (!normalized) {
      return 'Column';
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private async syncItemBoardPositionFromViewColumn(input: {
    workspaceId: string;
    itemId: string;
    columnKey: string;
    columnName: string;
    requestedBy: string | null;
  }): Promise<void> {
    const normalizedColumnKey = toSlug(input.columnKey || input.columnName);
    if (!normalizedColumnKey) {
      return;
    }

    const workflowStateDelegate = this.prisma.workflowState;
    if (!workflowStateDelegate) {
      return;
    }

    let targetState = await workflowStateDelegate.findFirst({
      where: {
        workspaceId: input.workspaceId,
        slug: normalizedColumnKey,
        isActive: true
      },
      select: {
        id: true,
        slug: true
      }
    });

    const boardColumnDelegate = this.prisma.boardColumn;
    let targetBoardColumn = boardColumnDelegate
      ? await boardColumnDelegate.findFirst({
          where: {
            workspaceId: input.workspaceId,
            slug: normalizedColumnKey,
            isActive: true
          },
          select: {
            id: true
          }
        })
      : null;

    const columnStateMappingDelegate = this.prisma.columnStateMapping;
    if (!targetBoardColumn && targetState && columnStateMappingDelegate) {
      const stateMapping = await columnStateMappingDelegate.findFirst({
        where: {
          workspaceId: input.workspaceId,
          stateId: targetState.id
        },
        orderBy: [{ position: 'asc' }],
        include: {
          column: {
            select: {
              id: true,
              isActive: true
            }
          }
        }
      });

      if (stateMapping?.column?.isActive) {
        targetBoardColumn = {
          id: stateMapping.column.id
        };
      }
    }

    if (!targetState && targetBoardColumn && columnStateMappingDelegate) {
      const columnMapping = await columnStateMappingDelegate.findFirst({
        where: {
          workspaceId: input.workspaceId,
          columnId: targetBoardColumn.id
        },
        orderBy: [{ position: 'asc' }],
        include: {
          state: {
            select: {
              id: true,
              slug: true,
              isActive: true
            }
          }
        }
      });

      if (columnMapping?.state?.isActive) {
        targetState = {
          id: columnMapping.state.id,
          slug: columnMapping.state.slug
        };
      }
    }

    if (!targetState && !targetBoardColumn) {
      return;
    }

    await this.prisma.item.update({
      where: { id: input.itemId },
      data: {
        stateId: targetState?.id,
        status: targetState?.slug,
        boardColumnId: targetBoardColumn?.id,
        columnId: targetBoardColumn?.id,
        updatedBy: input.requestedBy ?? undefined
      }
    });
  }
}
