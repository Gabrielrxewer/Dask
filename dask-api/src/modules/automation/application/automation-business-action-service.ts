import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { redactErrorMessage } from '@/core/security/redaction';
import type { AuthorizationService, Permission } from '@/modules/identity/domain/authorization';
import type { BillingService } from '@/modules/billing/application/billing-service';
import type { WorkspaceCustomersService } from '@/modules/workspace-platform/application/workspace-customers-service';
import type { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';

type DocumentKind = 'wiki' | 'proposal' | 'contract';
type CommercialDocumentStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'accepted' | 'signed';

type WorkItemContext = {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  fields: Record<string, unknown>;
  metadata: Record<string, unknown>;
  customFields: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
};

export type AutomationBusinessActionResult = {
  skipped?: boolean;
  reason?: string;
  [key: string]: unknown;
};

export type AutomationBusinessActionServices = {
  prisma: PrismaClient;
  workItemsService: WorkspaceWorkItemsService;
  documentsService: WorkspaceDocumentsService;
  customersService: WorkspaceCustomersService;
  billingService?: BillingService | null;
  authorizationService?: AuthorizationService | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readValue(source: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!isRecord(current)) {
        return undefined;
      }

      return current[segment];
    }, source);
}

function renderTemplate(value: string, context: Record<string, unknown>): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = readValue(context, path);
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
}

function toCurrencyMinorUnit(value: unknown, unit: 'major' | 'minor'): number | null {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value.replace(',', '.'))
      : NaN;

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return unit === 'minor'
    ? Math.round(numberValue)
    : Math.round(numberValue * 100);
}

function mergeFieldValues(item: {
  fields: unknown;
  metadata: unknown;
  customFieldValues: Array<{ value: unknown; field: { slug: string } }>;
}): {
  fields: Record<string, unknown>;
  metadata: Record<string, unknown>;
  customFields: Record<string, unknown>;
} {
  const fields = isRecord(item.fields) ? { ...item.fields } : {};
  const metadata = isRecord(item.metadata) ? { ...item.metadata } : {};
  const customFields = item.customFieldValues.reduce<Record<string, unknown>>((acc, entry) => {
    acc[entry.field.slug] = entry.value;
    return acc;
  }, { ...fields });

  return { fields, metadata, customFields };
}

export class AutomationBusinessActionService {
  public constructor(private readonly services: AutomationBusinessActionServices) {}

  private async assertPermission(input: {
    workspaceId: string;
    userId: string;
    permission: Permission;
    itemId?: string;
  }): Promise<void> {
    if (!this.services.authorizationService) {
      return;
    }

    const allowed = await this.services.authorizationService.can(input.userId, input.permission, {
      workspaceId: input.workspaceId,
      itemId: input.itemId
    });

    if (!allowed) {
      throw new AppError('Automation actor is not allowed to perform this business action.', 403, {
        permission: input.permission,
        itemId: input.itemId
      });
    }
  }

  public async moveWorkItem(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    columnId?: string | null;
    columnSlug?: string | null;
    stateId?: string | null;
    stateSlug?: string | null;
    position?: number;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'item.transition'
    });
    const item = await this.requireWorkItem(input.workspaceId, input.itemId);
    const column = input.columnId || input.columnSlug
      ? await this.resolveBoardColumn(input.workspaceId, input.columnId ?? undefined, input.columnSlug ?? undefined)
      : null;
    const state = input.stateId || input.stateSlug
      ? await this.resolveWorkflowState(input.workspaceId, input.stateId ?? undefined, input.stateSlug ?? undefined)
      : null;

    if (!column && !state) {
      throw new AppError('move_work_item requires a target column or state.', 422);
    }

    if (
      (!column || item.boardColumnId === column.id) &&
      (!state || item.stateId === state.id)
    ) {
      return {
        skipped: true,
        reason: 'Work item is already in the requested column/state.',
        itemId: item.id,
        columnId: item.boardColumnId,
        stateId: item.stateId
      };
    }

    const moved = state
      ? await this.services.workItemsService.transitionWorkItem({
          workspaceId: input.workspaceId,
          itemId: input.itemId,
          userId: input.userId,
          payload: {
            stateId: state.id,
            ...(column ? { columnId: column.id } : {})
          }
        })
      : await this.services.workItemsService.moveWorkItem({
          workspaceId: input.workspaceId,
          itemId: input.itemId,
          userId: input.userId,
          payload: {
            columnId: column!.id,
            position: input.position
          }
        });

    return {
      itemId: moved.id,
      columnId: moved.column.id,
      columnSlug: moved.column.slug,
      stateId: moved.state.id,
      stateSlug: moved.state.slug
    };
  }

  public async updateWorkItemFields(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    title?: string;
    description?: string;
    customFieldValues?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    typeSlug?: string;
    assigneeId?: string | null;
    dueDate?: Date | null;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'item.update'
    });
    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const customFieldValues = input.customFieldValues
      ? await this.mapCustomFieldSlugsToIds(input.workspaceId, input.customFieldValues)
      : undefined;

    const updated = await this.services.workItemsService.updateWorkItem({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      userId: input.userId,
      payload: {
        title: input.title,
        description: input.description,
        typeSlug: input.typeSlug,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        metadata: input.metadata ? { ...item.metadata, ...input.metadata } : undefined,
        customFieldValues
      }
    });

    return {
      itemId: updated.id,
      updatedFields: Object.keys(input.customFieldValues ?? {}),
      title: updated.title,
      type: updated.type,
      assigneeId: updated.assigneeId,
      dueDate: updated.dueDate
    };
  }

  public async replicateWorkItemTypeFields(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    transformationId?: string | null;
    toTypeId?: string | null;
    toTypeSlug?: string | null;
    defaultValuesForNewFields?: Record<string, unknown>;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'item.update'
    });

    const validation = await this.services.workItemsService.validateWorkItemTypeTransformation({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      userId: input.userId,
      payload: {
        transformationId: input.transformationId ?? undefined,
        toTypeId: input.toTypeId ?? undefined,
        toTypeSlug: input.toTypeSlug ?? undefined,
        defaultValuesForNewFields: input.defaultValuesForNewFields
      }
    });

    return {
      itemId: input.itemId,
      fromTypeSlug: validation.fromType.slug,
      toTypeSlug: validation.toType.slug,
      copiedFields: validation.replicationPlan?.copied ?? validation.preservedFields,
      skippedFields: validation.replicationPlan?.skipped ?? validation.missingFields,
      incompatibleFields: validation.replicationPlan?.incompatible ?? [],
      valid: validation.valid
    };
  }

  public async transformWorkItemType(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    transformationId?: string | null;
    toTypeId?: string | null;
    toTypeSlug?: string | null;
    stateId?: string | null;
    stateSlug?: string | null;
    customFieldValues?: Record<string, unknown>;
    defaultValuesForNewFields?: Record<string, unknown>;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'item.transition'
    });

    const item = await this.services.workItemsService.transformWorkItemType({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      userId: input.userId,
      payload: {
        transformationId: input.transformationId ?? undefined,
        toTypeId: input.toTypeId ?? undefined,
        toTypeSlug: input.toTypeSlug ?? undefined,
        stateId: input.stateId ?? undefined,
        stateSlug: input.stateSlug ?? undefined,
        customFieldValues: input.customFieldValues,
        defaultValuesForNewFields: input.defaultValuesForNewFields
      }
    });

    return {
      itemId: item.id,
      type: item.type,
      stateId: item.state.id,
      stateSlug: item.state.slug
    };
  }

  public async createProposal(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    title?: string;
    content?: string;
    status?: CommercialDocumentStatus;
    binding?: string | null;
    templateKey?: string | null;
    targetFieldSlug?: string | null;
    skipIfExists?: boolean;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'file.upload'
    });

    return this.createDocument({
      ...input,
      kind: 'proposal',
      binding: input.binding ?? input.templateKey ?? 'commercial_proposal',
      targetFieldSlug: input.targetFieldSlug ?? 'proposalId'
    });
  }

  public async createContract(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    proposalId?: string | null;
    proposalFieldSlug?: string | null;
    title?: string;
    content?: string;
    status?: CommercialDocumentStatus;
    binding?: string | null;
    templateKey?: string | null;
    targetFieldSlug?: string | null;
    skipIfExists?: boolean;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'file.upload'
    });

    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const proposalFieldSlug = input.proposalFieldSlug ?? 'proposalId';
    const proposalId = cleanText(input.proposalId) ?? cleanText(item.customFields[proposalFieldSlug]);
    if (!proposalId) {
      throw new AppError('create_contract requires an approved proposal reference.', 422, {
        proposalFieldSlug
      });
    }

    const proposal = await this.findDocumentById(input.workspaceId, proposalId);
    if (!proposal || proposal.kind !== 'proposal') {
      throw new AppError('Proposal document not found for create_contract.', 404, { proposalId });
    }

    const proposalMetadata = isRecord(proposal.metadata) ? proposal.metadata : {};
    const proposalStatus = cleanText(proposalMetadata.status);
    if (proposalStatus && proposalStatus !== 'approved') {
      throw new AppError('create_contract requires an approved proposal.', 422, {
        proposalId,
        proposalStatus
      });
    }

    return this.createDocument({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      kind: 'contract',
      title: input.title,
      content: input.content,
      status: input.status,
      binding: input.binding ?? input.templateKey ?? 'commercial_contract',
      targetFieldSlug: input.targetFieldSlug ?? 'contractId',
      skipIfExists: input.skipIfExists,
      sourceDocumentId: proposalId
    });
  }

  public async createDocument(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    kind: DocumentKind;
    title?: string;
    content?: string;
    status?: CommercialDocumentStatus;
    binding?: string | null;
    targetFieldSlug?: string | null;
    skipIfExists?: boolean;
    sourceDocumentId?: string | null;
  }): Promise<AutomationBusinessActionResult> {
    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const existingDocumentId = input.targetFieldSlug
      ? cleanText(item.customFields[input.targetFieldSlug])
      : null;

    if (existingDocumentId && input.skipIfExists !== false) {
      const existing = await this.findDocumentById(input.workspaceId, existingDocumentId);
      if (existing) {
        return {
          skipped: true,
          reason: 'Target document already exists.',
          documentId: existing.id,
          documentKind: existing.kind
        };
      }
    }

    const context = this.buildTemplateContext(item);
    const document = await this.services.documentsService.createDocument({
      workspaceId: input.workspaceId,
      userId: input.userId,
      payload: {
        kind: input.kind,
        title: input.title
          ? renderTemplate(input.title, context)
          : this.defaultDocumentTitle(input.kind, item),
        content: input.content
          ? renderTemplate(input.content, context)
          : this.defaultDocumentContent(input.kind, item),
        linkedEntityType: 'work_item',
        linkedEntityId: input.itemId,
        metadata: {
          status: input.status ?? 'draft',
          source: 'automation',
          binding: input.binding ?? null,
          sourceWorkItemId: input.itemId,
          sourceDocumentId: input.sourceDocumentId ?? null
        }
      }
    });

    try {
      await this.services.workItemsService.linkDocumentToWorkItem({
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        documentId: document.id,
        userId: input.userId
      });

      if (input.targetFieldSlug) {
        await this.setWorkItemFieldBySlug({
          workspaceId: input.workspaceId,
          itemId: input.itemId,
          userId: input.userId,
          slug: input.targetFieldSlug,
          value: document.id
        });
      }

      await this.createItemHistory({
        itemId: input.itemId,
        eventName: `${input.kind}.created_by_automation`,
        payload: {
          documentId: document.id,
          documentKind: document.kind,
          status: document.metadata?.status ?? input.status ?? 'draft'
        }
      });
    } catch (error) {
      await this.markDocumentPartialFailure(input.workspaceId, document.id, error);
      throw new AppError('Document was created but could not be fully linked to the card.', 500, {
        documentId: document.id,
        reason: redactErrorMessage(error)
      });
    }

    return {
      documentId: document.id,
      documentKind: document.kind,
      status: document.metadata?.status ?? input.status ?? 'draft'
    };
  }

  public async updateDocumentStatus(input: {
    workspaceId: string;
    userId: string;
    itemId?: string | null;
    documentId?: string | null;
    documentFieldSlug?: string | null;
    kind?: DocumentKind | null;
    status: CommercialDocumentStatus;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId ?? undefined,
      permission: 'file.upload'
    });
    const document = await this.resolveDocumentReference(input);
    const metadata = isRecord(document.metadata) ? { ...document.metadata } : {};

    if (metadata.status === input.status) {
      return {
        skipped: true,
        reason: 'Document already has requested status.',
        documentId: document.id,
        status: input.status
      };
    }

    const updated = await this.services.documentsService.updateDocument({
      workspaceId: input.workspaceId,
      documentId: document.id,
      userId: input.userId,
      payload: {
        metadata: {
          ...metadata,
          status: input.status
        }
      }
    });

    return {
      documentId: updated.id,
      documentKind: updated.kind,
      status: updated.metadata?.status ?? input.status
    };
  }

  public async sendDocument(input: {
    workspaceId: string;
    userId: string;
    itemId?: string | null;
    documentId?: string | null;
    documentFieldSlug?: string | null;
    kind?: DocumentKind | null;
    email?: string | null;
    emails?: string[];
    resend?: boolean;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId ?? undefined,
      permission: 'file.upload'
    });
    const document = await this.resolveDocumentReference(input);
    const metadata = isRecord(document.metadata) ? document.metadata : {};

    if (metadata.status === 'sent' && !input.resend) {
      return {
        skipped: true,
        reason: 'Document has already been sent.',
        documentId: document.id
      };
    }

    const item = input.itemId ? await this.loadWorkItemContext(input.workspaceId, input.itemId) : null;
    const recipientEmails = [
      ...(input.emails ?? []),
      input.email,
      item ? cleanText(item.customFields.contactEmail) : null
    ]
      .filter((value): value is string => Boolean(cleanText(value)))
      .map((value) => value.trim().toLowerCase());

    const uniqueEmails = Array.from(new Set(recipientEmails));
    if (uniqueEmails.length === 0) {
      throw new AppError('send_document requires at least one recipient email.', 422);
    }

    const sent = await this.services.documentsService.sendCommercialDocument({
      workspaceId: input.workspaceId,
      documentId: document.id,
      userId: input.userId,
      payload: {
        emails: uniqueEmails
      }
    });

    if (input.itemId) {
      await this.createItemHistory({
        itemId: input.itemId,
        eventName: `${sent.kind}.sent_by_automation`,
        payload: {
          documentId: sent.id,
          sentToEmails: uniqueEmails
        }
      });
    }

    return {
      documentId: sent.id,
      documentKind: sent.kind,
      status: sent.metadata?.status ?? 'sent',
      sentToEmails: uniqueEmails
    };
  }

  public async ensureCustomerFromWorkItem(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    status?: 'prospect' | 'active' | 'inactive' | 'archived';
    targetFieldSlug?: string | null;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'item.update'
    });
    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const targetFieldSlug = input.targetFieldSlug ?? 'customerId';
    const existingCustomerId = cleanText(item.customFields[targetFieldSlug]);

    if (existingCustomerId) {
      const existing = await this.services.prisma.customer.findFirst({
        where: {
          id: existingCustomerId,
          workspaceId: input.workspaceId
        },
        select: { id: true }
      });

      if (existing) {
        return {
          skipped: true,
          reason: 'Work item already has a valid customer.',
          customerId: existing.id
        };
      }
    }

    const document = cleanText(item.customFields.clientDocument);
    const email = cleanText(item.customFields.contactEmail);
    const customerLookupFilters = [
      ...(document ? [{ document }] : []),
      ...(email ? [{ email: email.toLowerCase() }] : [])
    ];
    const existing = customerLookupFilters.length > 0
      ? await this.services.prisma.customer.findFirst({
          where: {
            workspaceId: input.workspaceId,
            OR: customerLookupFilters
          },
          orderBy: { updatedAt: 'desc' }
        })
      : null;

    const customer = existing
      ? existing
      : await this.services.customersService.createCustomer({
          workspaceId: input.workspaceId,
          userId: input.userId,
          payload: {
            name:
              cleanText(item.customFields.clientName) ??
              cleanText(item.customFields.companyName) ??
              cleanText(item.customFields.contactName) ??
              item.title,
            tradeName: cleanText(item.customFields.companyName),
            legalName: cleanText(item.customFields.clientLegalName),
            document,
            email,
            phone: cleanText(item.customFields.contactPhone),
            website: cleanText(item.customFields.website),
            status: input.status ?? 'active',
            notes: item.description,
            sourceWorkItemId: item.id
          }
        });

    await this.setWorkItemFieldBySlug({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      userId: input.userId,
      slug: targetFieldSlug,
      value: customer.id
    });

    return {
      customerId: customer.id,
      reusedExistingCustomer: Boolean(existing)
    };
  }

  public async createBillingOrder(input: {
    workspaceId: string;
    userId: string;
    itemId: string;
    targetFieldSlug?: string | null;
    catalogItemId?: string | null;
    catalogItemFieldSlug?: string | null;
    amountCents?: number | null;
    amountFieldSlug?: string | null;
    amountFieldUnit?: 'major' | 'minor';
    description?: string | null;
    customerIdFieldSlug?: string | null;
    sendEmail?: boolean;
    skipIfExists?: boolean;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.itemId,
      permission: 'billing.manage'
    });
    if (!this.services.billingService) {
      throw new AppError('Billing service is not configured for create_billing_order.', 503);
    }

    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const targetFieldSlug = input.targetFieldSlug ?? 'billingOrderId';
    const existingOrderId = cleanText(item.customFields[targetFieldSlug]);

    if (existingOrderId && input.skipIfExists !== false) {
      const existing = await this.services.prisma.connectPaymentOrder.findFirst({
        where: {
          id: existingOrderId,
          workspaceId: input.workspaceId
        },
        select: { id: true, checkoutUrl: true, status: true }
      });

      if (existing) {
        return {
          skipped: true,
          reason: 'Billing order already exists.',
          billingOrderId: existing.id,
          billingStatus: existing.status,
          checkoutUrl: existing.checkoutUrl
        };
      }
    }

    const catalogItemId =
      cleanText(input.catalogItemId) ??
      (input.catalogItemFieldSlug ? cleanText(item.customFields[input.catalogItemFieldSlug]) : null) ??
      cleanText(item.customFields.interest);
    const amount = input.amountCents ??
      toCurrencyMinorUnit(
        input.amountFieldSlug ? item.customFields[input.amountFieldSlug] : item.customFields.estimatedValue,
        input.amountFieldUnit ?? 'major'
      );
    const customerId = cleanText(item.customFields[input.customerIdFieldSlug ?? 'customerId']);
    const description = input.description
      ? renderTemplate(input.description, this.buildTemplateContext(item))
      : cleanText(item.customFields.interestLabel) ?? cleanText(item.customFields.interest) ?? item.title;

    const result = await this.services.billingService.createConnectCheckoutSession(input.workspaceId, input.userId, {
      ...(catalogItemId ? { catalogItemId } : {}),
      ...(amount && !catalogItemId ? { amount } : {}),
      description,
      customerId: customerId ?? undefined,
      customerName:
        cleanText(item.customFields.clientName) ??
        cleanText(item.customFields.companyName) ??
        cleanText(item.customFields.contactName) ??
        undefined,
      customerEmail: cleanText(item.customFields.contactEmail) ?? undefined,
      sendEmail: input.sendEmail ?? true,
      metadata: {
        source: 'automation',
        sourceWorkItemId: item.id
      }
    });

    try {
      await this.setWorkItemFieldBySlug({
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        userId: input.userId,
        slug: targetFieldSlug,
        value: result.orderId
      });
      await this.createItemHistory({
        itemId: input.itemId,
        eventName: 'billing.created_by_automation',
        payload: {
          billingOrderId: result.orderId,
          checkoutUrl: result.url
        }
      });
    } catch (error) {
      await this.createItemHistory({
        itemId: input.itemId,
        eventName: 'billing.automation_partial_failure',
        payload: {
          billingOrderId: result.orderId,
          checkoutUrl: result.url,
          reason: redactErrorMessage(error)
        }
      });
      throw new AppError('Billing order was created but could not be linked to the card.', 500, {
        billingOrderId: result.orderId,
        reason: redactErrorMessage(error)
      });
    }

    return {
      billingOrderId: result.orderId,
      checkoutUrl: result.url,
      sessionId: result.sessionId
    };
  }

  public async createFollowupTask(input: {
    workspaceId: string;
    userId: string;
    sourceItemId: string;
    title?: string;
    description?: string;
    stateSlug?: string | null;
    columnSlug?: string | null;
    dueDate?: Date | null;
    assigneeId?: string | null;
  }): Promise<AutomationBusinessActionResult> {
    await this.assertPermission({
      workspaceId: input.workspaceId,
      userId: input.userId,
      itemId: input.sourceItemId,
      permission: 'item.create'
    });
    const sourceItem = await this.loadWorkItemContext(input.workspaceId, input.sourceItemId);
    const context = this.buildTemplateContext(sourceItem);
    const column = input.columnSlug
      ? await this.resolveBoardColumn(input.workspaceId, undefined, input.columnSlug)
      : await this.resolveBoardColumn(input.workspaceId, undefined, sourceItem.status);
    const state = input.stateSlug
      ? await this.resolveWorkflowState(input.workspaceId, undefined, input.stateSlug)
      : await this.resolveWorkflowState(input.workspaceId, undefined, sourceItem.status);

    const created = await this.services.workItemsService.createWorkItem({
      workspaceId: input.workspaceId,
      userId: input.userId,
      payload: {
        boardId: sourceItem.boardId,
        title: input.title ? renderTemplate(input.title, context) : `Follow-up: ${sourceItem.title}`,
        description: input.description ? renderTemplate(input.description, context) : sourceItem.description ?? undefined,
        typeSlug: sourceItem.type,
        stateId: state.id,
        columnId: column.id,
        assigneeId: input.assigneeId ?? cleanText(sourceItem.customFields.assigneeId) ?? undefined,
        dueDate: input.dueDate ?? undefined,
        parentId: sourceItem.id,
        metadata: {
          source: 'automation',
          sourceWorkItemId: sourceItem.id
        }
      }
    });

    await this.createItemHistory({
      itemId: sourceItem.id,
      eventName: 'followup.created_by_automation',
      payload: {
        followupItemId: created.id,
        title: created.title
      }
    });

    return {
      itemId: created.id,
      parentId: sourceItem.id
    };
  }

  public async registerCardActivity(input: {
    workspaceId: string;
    itemId: string;
    eventName: string;
    payload?: Record<string, unknown>;
  }): Promise<AutomationBusinessActionResult> {
    await this.requireWorkItem(input.workspaceId, input.itemId);
    const history = await this.createItemHistory(input);

    return {
      historyId: history.id,
      eventName: history.eventName
    };
  }

  private async createItemHistory(input: {
    itemId: string;
    eventName: string;
    payload?: Record<string, unknown>;
  }) {
    return this.services.prisma.itemHistory.create({
      data: {
        itemId: input.itemId,
        eventName: input.eventName,
        payload: toInputJson(input.payload ?? {})
      }
    });
  }

  private async markDocumentPartialFailure(workspaceId: string, documentId: string, error: unknown): Promise<void> {
    const document = await this.findDocumentById(workspaceId, documentId);
    if (!document) {
      return;
    }

    const metadata = isRecord(document.metadata) ? { ...document.metadata } : {};
    await this.services.prisma.workspaceDocument.update({
      where: { id: document.id },
      data: {
        metadata: toInputJson({
          ...metadata,
          automationPartialFailure: true,
          automationPartialFailureReason: redactErrorMessage(error)
        })
      }
    });
  }

  private async setWorkItemFieldBySlug(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    slug: string;
    value: unknown;
  }) {
    const field = await this.services.prisma.customFieldDefinition.findFirst({
      where: {
        workspaceId: input.workspaceId,
        slug: input.slug
      },
      select: { id: true }
    });

    if (!field) {
      throw new AppError(`Custom field '${input.slug}' does not exist in this workspace.`, 422);
    }

    return this.services.workItemsService.setWorkItemCustomFieldValue({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      fieldId: field.id,
      userId: input.userId,
      value: input.value
    });
  }

  private async mapCustomFieldSlugsToIds(workspaceId: string, values: Record<string, unknown>) {
    const slugs = Object.keys(values);
    if (slugs.length === 0) {
      return {};
    }

    const fields = await this.services.prisma.customFieldDefinition.findMany({
      where: {
        workspaceId,
        slug: { in: slugs }
      },
      select: {
        id: true,
        slug: true
      }
    });

    if (fields.length !== slugs.length) {
      const found = new Set(fields.map((field) => field.slug));
      const missing = slugs.filter((slug) => !found.has(slug));
      throw new AppError('One or more custom field slugs do not belong to this workspace.', 422, {
        missing
      });
    }

    return fields.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.id] = values[field.slug];
      return acc;
    }, {});
  }

  private async resolveBoardColumn(workspaceId: string, id?: string, slug?: string) {
    const column = await this.services.prisma.boardColumn.findFirst({
      where: {
        workspaceId,
        ...(id ? { id } : { slug })
      },
      select: {
        id: true,
        slug: true,
        name: true
      }
    });

    if (!column) {
      throw new AppError('Board column not found for automation action.', 404, { id, slug });
    }

    return column;
  }

  private async resolveWorkflowState(workspaceId: string, id?: string, slug?: string) {
    const state = await this.services.prisma.workflowState.findFirst({
      where: {
        workspaceId,
        ...(id ? { id } : { slug })
      },
      select: {
        id: true,
        slug: true,
        name: true
      }
    });

    if (!state) {
      throw new AppError('Workflow state not found for automation action.', 404, { id, slug });
    }

    return state;
  }

  private async requireWorkItem(workspaceId: string, itemId: string) {
    const item = await this.services.prisma.item.findFirst({
      where: { id: itemId, workspaceId },
      select: {
        id: true,
        boardColumnId: true,
        columnId: true,
        stateId: true
      }
    });

    if (!item) {
      throw new AppError('Work item not found for automation action.', 404, { itemId });
    }

    return item;
  }

  private async loadWorkItemContext(workspaceId: string, itemId: string): Promise<WorkItemContext> {
    const item = await this.services.prisma.item.findFirst({
      where: { id: itemId, workspaceId },
      include: {
        customFieldValues: {
          include: {
            field: {
              select: {
                slug: true
              }
            }
          }
        }
      }
    });

    if (!item) {
      throw new AppError('Work item not found for automation action.', 404, { itemId });
    }

    const merged = mergeFieldValues(item);
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      boardId: item.boardId,
      title: item.title,
      description: item.description,
      type: item.type,
      status: item.status,
      fields: merged.fields,
      metadata: merged.metadata,
      customFields: merged.customFields,
      createdBy: item.createdBy,
      updatedBy: item.updatedBy
    };
  }

  private async findDocumentById(workspaceId: string, documentId: string) {
    return this.services.prisma.workspaceDocument.findFirst({
      where: { id: documentId, workspaceId }
    });
  }

  private async resolveDocumentReference(input: {
    workspaceId: string;
    itemId?: string | null;
    documentId?: string | null;
    documentFieldSlug?: string | null;
    kind?: DocumentKind | null;
  }) {
    const directId = cleanText(input.documentId);
    if (directId) {
      const document = await this.findDocumentById(input.workspaceId, directId);
      if (!document) {
        throw new AppError('Document not found for automation action.', 404, { documentId: directId });
      }
      return document;
    }

    if (!input.itemId) {
      throw new AppError('Document action requires documentId or itemId.', 422);
    }

    const item = await this.loadWorkItemContext(input.workspaceId, input.itemId);
    const fieldDocumentId = input.documentFieldSlug
      ? cleanText(item.customFields[input.documentFieldSlug])
      : null;

    if (fieldDocumentId) {
      const document = await this.findDocumentById(input.workspaceId, fieldDocumentId);
      if (document) {
        return document;
      }
    }

    const link = await this.services.prisma.workItemDocumentLink.findFirst({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        ...(input.kind
          ? {
              document: {
                kind: input.kind
              }
            }
          : {})
      },
      include: {
        document: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!link) {
      throw new AppError('Linked document not found for automation action.', 404, {
        itemId: input.itemId,
        kind: input.kind
      });
    }

    return link.document;
  }

  private defaultDocumentTitle(kind: DocumentKind, item: WorkItemContext): string {
    if (kind === 'proposal') {
      return `Proposta - ${item.title}`;
    }
    if (kind === 'contract') {
      return `Contrato - ${item.title}`;
    }
    return `Documento - ${item.title}`;
  }

  private defaultDocumentContent(kind: DocumentKind, item: WorkItemContext): string {
    const fields = item.customFields;
    const heading = kind === 'proposal'
      ? 'Proposta comercial'
      : kind === 'contract'
        ? 'Contrato comercial'
        : 'Documento comercial';

    return [
      `# ${heading}`,
      '',
      `Cliente: ${cleanText(fields.clientName) ?? cleanText(fields.companyName) ?? cleanText(fields.contactName) ?? item.title}`,
      `Contato: ${cleanText(fields.contactName) ?? '-'}`,
      `E-mail: ${cleanText(fields.contactEmail) ?? '-'}`,
      `Escopo: ${cleanText(fields.interest) ?? cleanText(fields.paymentTerms) ?? item.description ?? '-'}`,
      `Valor estimado: ${fields.estimatedValue ?? '-'}`,
      '',
      item.description ?? ''
    ].join('\n');
  }

  private buildTemplateContext(item: WorkItemContext): Record<string, unknown> {
    return {
      item,
      fields: item.customFields,
      contact: item.customFields,
      customer: item.customFields
    };
  }
}
