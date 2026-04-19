import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  Lead,
  LeadActivityType,
  LeadConversionType,
  LeadDistributionStrategy,
  LeadIntegrationSource,
  LeadNurtureTouch,
  LeadQualificationStatus,
  LeadStatus,
  Prisma
} from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import {
  buildWebhookIdempotencyKey,
  computeLeadStatus,
  normalizeEmail,
  normalizeScore,
  normalizeTags,
  normalizeText,
  resolveDistributionStatus,
  resolveLeadName,
  resolveNurtureStatus,
  toActivityTitle,
  type CaptureLeadInput,
  type LeadWebhookInput
} from '@/modules/leads/domain/types';
import type { LeadsDashboard, LeadsRepository, LeadWithRelations } from '@/modules/leads/repositories/leads-repository';

interface LeadsServiceDeps {
  repo: LeadsRepository;
  eventPublisher: EventPublisher;
  webhookSecret?: string;
}

function asJsonValue(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function stripBearer(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase().startsWith('bearer ')) {
    return normalized.slice('bearer '.length).trim();
  }

  return normalized;
}

function resolveSource(source: string): LeadIntegrationSource {
  const normalized = source.trim().toLowerCase();

  if (normalized === 'zapier') {
    return 'ZAPIER';
  }

  if (normalized === 'make' || normalized === 'integromat') {
    return 'MAKE';
  }

  if (normalized === 'n8n') {
    return 'N8N';
  }

  if (normalized === 'hubspot') {
    return 'HUBSPOT';
  }

  if (normalized === 'rd' || normalized === 'rd_station' || normalized === 'rdstation') {
    return 'RD_STATION';
  }

  return 'GENERIC_WEBHOOK';
}

export class LeadsService {
  private readonly repo: LeadsRepository;
  private readonly eventPublisher: EventPublisher;
  private readonly webhookSecret: string | null;

  public constructor(deps: LeadsServiceDeps) {
    this.repo = deps.repo;
    this.eventPublisher = deps.eventPublisher;
    this.webhookSecret = deps.webhookSecret?.trim() ? deps.webhookSecret.trim() : null;
  }

  public async listLeads(input: {
    workspaceId: string;
    status?: LeadStatus;
    ownerUserId?: string;
    qualificationStatus?: LeadQualificationStatus;
    distributionStatus?: 'UNASSIGNED' | 'ASSIGNED' | 'ACCEPTED' | 'REASSIGNED';
    search?: string;
    limit?: number;
  }): Promise<Lead[]> {
    return this.repo.listLeads({
      ...input,
      limit: Math.max(1, Math.min(200, input.limit ?? 50))
    });
  }

  public async getDashboard(workspaceId: string): Promise<LeadsDashboard> {
    return this.repo.getDashboard(workspaceId);
  }

  public async getLeadDetails(workspaceId: string, leadId: string): Promise<LeadWithRelations> {
    const lead = await this.repo.findLeadById(workspaceId, leadId);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    return lead;
  }

  public async captureLead(input: CaptureLeadInput): Promise<Lead> {
    const normalizedSource = input.externalSource ?? null;
    const normalizedExternalId = normalizeText(input.externalId);

    if (normalizedSource && normalizedExternalId) {
      const existing = await this.repo.findLeadByExternal({
        workspaceId: input.workspaceId,
        externalSource: normalizedSource,
        externalId: normalizedExternalId
      });

      if (existing) {
        return existing;
      }
    }

    const { firstName, lastName, fullName } = resolveLeadName({
      firstName: input.firstName,
      lastName: input.lastName,
      fullName: input.fullName
    });

    const created = await this.repo.createLead({
      workspaceId: input.workspaceId,
      externalSource: normalizedSource,
      externalId: normalizedExternalId,
      captureSource: input.source,
      status: 'CAPTURED',
      qualificationStatus: 'UNQUALIFIED',
      distributionStatus: 'UNASSIGNED',
      score: normalizeScore(input.score),
      firstName,
      lastName,
      fullName,
      email: normalizeEmail(input.email),
      phone: normalizeText(input.phone),
      companyName: normalizeText(input.companyName),
      jobTitle: normalizeText(input.jobTitle),
      website: normalizeText(input.website),
      city: normalizeText(input.city),
      state: normalizeText(input.state),
      country: normalizeText(input.country),
      interest: normalizeText(input.interest),
      notes: normalizeText(input.notes),
      tags: normalizeTags(input.tags),
      estimatedValue: normalizeText(input.estimatedValue) ? new Decimal(input.estimatedValue!) : null,
      currency: normalizeText(input.currency)?.toUpperCase() ?? 'BRL',
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      createdByUserId: input.createdByUserId ?? null,
      updatedByUserId: input.createdByUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: created.id,
      actorUserId: input.createdByUserId ?? null,
      type: 'CAPTURED',
      description: 'Lead capturado no modulo de Leads.',
      payload: {
        source: input.source,
        externalSource: normalizedSource,
        externalId: normalizedExternalId
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadCaptured,
      aggregateType: 'lead',
      aggregateId: created.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: created.id,
        source: input.source,
        score: created.score,
        createdBy: input.createdByUserId ?? null
      }
    });

    return created;
  }

  public async qualifyLead(input: {
    workspaceId: string;
    leadId: string;
    qualificationStatus: LeadQualificationStatus;
    score?: number;
    temperature?: string;
    notes?: string;
    qualifiedByUserId?: string | null;
  }): Promise<Lead> {
    const current = await this.requireLead(input.workspaceId, input.leadId);
    const score = input.score === undefined ? current.score : normalizeScore(input.score);
    const qualifiedAt = input.qualificationStatus === 'UNQUALIFIED' ? null : new Date();

    const status = computeLeadStatus({
      convertedAt: current.convertedAt,
      lostAt: current.lostAt,
      qualificationStatus: input.qualificationStatus,
      distributionStatus: current.distributionStatus,
      nurturingStartedAt: current.nurturingStartedAt,
      lastContactAt: current.lastContactAt
    });

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      qualificationStatus: input.qualificationStatus,
      score,
      temperature: normalizeText(input.temperature),
      notes: normalizeText(input.notes) ?? current.notes,
      qualifiedAt,
      status,
      updatedByUserId: input.qualifiedByUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.qualifiedByUserId ?? null,
      type: 'QUALIFIED',
      description: `Lead classificado como ${input.qualificationStatus}.`,
      payload: {
        previousQualificationStatus: current.qualificationStatus,
        qualificationStatus: input.qualificationStatus,
        score,
        temperature: normalizeText(input.temperature)
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadQualified,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        qualificationStatus: input.qualificationStatus,
        score,
        requestedBy: input.qualifiedByUserId ?? null
      }
    });

    return updated;
  }

  public async distributeLead(input: {
    workspaceId: string;
    leadId: string;
    toUserId: string;
    strategy: LeadDistributionStrategy;
    reason?: string;
    distributedByUserId?: string | null;
  }): Promise<Lead> {
    const current = await this.requireLead(input.workspaceId, input.leadId);
    const distributionStatus = resolveDistributionStatus(input.strategy);

    const status = computeLeadStatus({
      convertedAt: current.convertedAt,
      lostAt: current.lostAt,
      qualificationStatus: current.qualificationStatus,
      distributionStatus,
      nurturingStartedAt: current.nurturingStartedAt,
      lastContactAt: current.lastContactAt
    });

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      ownerUserId: input.toUserId,
      distributionStatus,
      distributedAt: new Date(),
      status,
      updatedByUserId: input.distributedByUserId ?? null
    });

    await this.repo.createAssignment({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      fromUserId: current.ownerUserId,
      toUserId: input.toUserId,
      strategy: input.strategy,
      reason: normalizeText(input.reason),
      assignedByUserId: input.distributedByUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.distributedByUserId ?? null,
      type: 'DISTRIBUTED',
      description: 'Lead distribuido para responsavel.',
      payload: {
        fromUserId: current.ownerUserId,
        toUserId: input.toUserId,
        strategy: input.strategy,
        reason: normalizeText(input.reason)
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadDistributed,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        toUserId: input.toUserId,
        strategy: input.strategy,
        requestedBy: input.distributedByUserId ?? null
      }
    });

    return updated;
  }

  public async registerFollowUp(input: {
    workspaceId: string;
    leadId: string;
    note?: string;
    nextFollowUpAt?: Date;
    actorUserId?: string | null;
  }): Promise<Lead> {
    const current = await this.requireLead(input.workspaceId, input.leadId);

    const status = computeLeadStatus({
      convertedAt: current.convertedAt,
      lostAt: current.lostAt,
      qualificationStatus: current.qualificationStatus,
      distributionStatus: current.distributionStatus,
      nurturingStartedAt: current.nurturingStartedAt,
      lastContactAt: new Date()
    });

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      lastContactAt: new Date(),
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      notes: normalizeText(input.note) ?? current.notes,
      status,
      updatedByUserId: input.actorUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: 'FOLLOW_UP',
      description: normalizeText(input.note) ?? 'Follow-up registrado.',
      payload: {
        nextFollowUpAt: input.nextFollowUpAt?.toISOString() ?? null
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadFollowUpRegistered,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        nextFollowUpAt: input.nextFollowUpAt?.toISOString() ?? null,
        requestedBy: input.actorUserId ?? null
      }
    });

    return updated;
  }

  public async registerNurtureTouch(input: {
    workspaceId: string;
    leadId: string;
    channel: string;
    templateKey?: string;
    subject?: string;
    message?: string;
    scheduledAt?: Date;
    sentAt?: Date;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<{ lead: Lead; touch: LeadNurtureTouch }> {
    const current = await this.requireLead(input.workspaceId, input.leadId);
    const touchStatus = resolveNurtureStatus(input.channel, input.sentAt ?? null);

    const touch = await this.repo.createNurtureTouch({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      status: touchStatus,
      channel: input.channel,
      templateKey: normalizeText(input.templateKey),
      subject: normalizeText(input.subject),
      message: normalizeText(input.message),
      scheduledAt: input.scheduledAt ?? null,
      sentAt: input.sentAt ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      createdByUserId: input.actorUserId ?? null
    });

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      nurturingStartedAt: current.nurturingStartedAt ?? new Date(),
      status: computeLeadStatus({
        convertedAt: current.convertedAt,
        lostAt: current.lostAt,
        qualificationStatus: current.qualificationStatus,
        distributionStatus: current.distributionStatus,
        nurturingStartedAt: new Date(),
        lastContactAt: current.lastContactAt
      }),
      updatedByUserId: input.actorUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: 'NURTURE_TOUCH',
      description: `Acao de nutricao registrada no canal ${input.channel}.`,
      payload: {
        touchId: touch.id,
        channel: input.channel,
        templateKey: normalizeText(input.templateKey),
        scheduledAt: input.scheduledAt?.toISOString() ?? null,
        sentAt: input.sentAt?.toISOString() ?? null,
        status: touchStatus
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadNurtureScheduled,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        touchId: touch.id,
        channel: input.channel,
        status: touchStatus,
        requestedBy: input.actorUserId ?? null
      }
    });

    return { lead: updated, touch };
  }

  public async convertLead(input: {
    workspaceId: string;
    leadId: string;
    conversionType: LeadConversionType;
    conversionRef: string;
    amount?: string;
    currency?: string;
    notes?: string;
    convertedByUserId?: string | null;
  }): Promise<Lead> {
    const current = await this.requireLead(input.workspaceId, input.leadId);

    if (current.status === 'LOST') {
      throw new AppError('Lead marcado como perdido nao pode ser convertido', 422);
    }

    await this.repo.upsertConversion({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      conversionType: input.conversionType,
      conversionRef: normalizeText(input.conversionRef) ?? input.conversionRef,
      amount: normalizeText(input.amount) ? new Decimal(input.amount!) : null,
      currency: normalizeText(input.currency)?.toUpperCase() ?? current.currency,
      notes: normalizeText(input.notes),
      convertedByUserId: input.convertedByUserId ?? null,
      convertedAt: new Date()
    });

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      status: 'CONVERTED',
      convertedAt: new Date(),
      lostAt: null,
      nextFollowUpAt: null,
      updatedByUserId: input.convertedByUserId ?? null
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.convertedByUserId ?? null,
      type: 'CONVERTED',
      description: 'Lead convertido.',
      payload: {
        conversionType: input.conversionType,
        conversionRef: normalizeText(input.conversionRef) ?? input.conversionRef,
        amount: normalizeText(input.amount),
        currency: normalizeText(input.currency)?.toUpperCase() ?? current.currency
      }
    });

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: DomainEventNames.LeadConverted,
      aggregateType: 'lead',
      aggregateId: input.leadId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        leadId: input.leadId,
        conversionType: input.conversionType,
        conversionRef: normalizeText(input.conversionRef) ?? input.conversionRef,
        requestedBy: input.convertedByUserId ?? null
      }
    });

    return updated;
  }

  public async markLeadAsLost(input: {
    workspaceId: string;
    leadId: string;
    reason?: string;
    actorUserId?: string | null;
  }): Promise<Lead> {
    const current = await this.requireLead(input.workspaceId, input.leadId);

    if (current.status === 'CONVERTED') {
      throw new AppError('Lead convertido nao pode ser marcado como perdido', 422);
    }

    const updated = await this.repo.updateLead(input.workspaceId, input.leadId, {
      status: 'LOST',
      lostAt: new Date(),
      updatedByUserId: input.actorUserId ?? null,
      notes: normalizeText(input.reason) ?? current.notes
    });

    await this.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: 'STATUS_CHANGED',
      description: normalizeText(input.reason) ?? 'Lead marcado como perdido.',
      payload: {
        previousStatus: current.status,
        nextStatus: 'LOST'
      }
    });

    return updated;
  }

  public async handleInboundWebhook(input: LeadWebhookInput): Promise<{ eventId: string; duplicate: boolean; leadId?: string }> {
    this.assertWebhookAuthorization(input.headers);

    const source = input.source;
    const idempotencyKey = buildWebhookIdempotencyKey(input);
    const existing = await this.repo.findIntegrationEventByIdempotencyKey(idempotencyKey);

    if (existing) {
      await this.repo.markIntegrationEventStatus(existing.id, 'DUPLICATE');
      return { eventId: existing.id, duplicate: true, leadId: existing.leadId ?? undefined };
    }

    const workspaceId = normalizeText(input.workspaceId ?? (input.payload['workspaceId'] as string | undefined));
    const leadPayload = asJsonValue(input.payload['lead']) ?? input.payload;

    const event = await this.repo.createIntegrationEvent({
      workspaceId,
      source,
      eventType: normalizeText((input.payload['eventType'] as string | undefined) ?? 'lead.inbound') ?? 'lead.inbound',
      providerEventId: normalizeText((input.payload['eventId'] as string | undefined) ?? (input.payload['id'] as string | undefined)),
      idempotencyKey,
      status: 'RECEIVED',
      headers: input.headers,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      attempts: 1
    });

    try {
      if (!workspaceId) {
        throw new AppError('workspaceId is required for lead ingestion', 422);
      }

      const captured = await this.captureLead({
        workspaceId,
        source: 'WEBHOOK',
        externalSource: source,
        externalId: normalizeText((leadPayload['externalId'] as string | undefined) ?? (leadPayload['id'] as string | undefined)),
        firstName: normalizeText(leadPayload['firstName'] as string | undefined),
        lastName: normalizeText(leadPayload['lastName'] as string | undefined),
        fullName: normalizeText(leadPayload['fullName'] as string | undefined) ?? normalizeText(leadPayload['name'] as string | undefined),
        email: normalizeText(leadPayload['email'] as string | undefined),
        phone: normalizeText(leadPayload['phone'] as string | undefined),
        companyName: normalizeText((leadPayload['companyName'] as string | undefined) ?? (leadPayload['company'] as string | undefined)),
        jobTitle: normalizeText(leadPayload['jobTitle'] as string | undefined),
        website: normalizeText(leadPayload['website'] as string | undefined),
        city: normalizeText(leadPayload['city'] as string | undefined),
        state: normalizeText(leadPayload['state'] as string | undefined),
        country: normalizeText(leadPayload['country'] as string | undefined),
        interest: normalizeText((leadPayload['interest'] as string | undefined) ?? (leadPayload['productInterest'] as string | undefined)),
        notes: normalizeText((leadPayload['notes'] as string | undefined) ?? (leadPayload['message'] as string | undefined)),
        tags: Array.isArray(leadPayload['tags']) ? (leadPayload['tags'] as string[]) : null,
        score: typeof leadPayload['score'] === 'number' ? (leadPayload['score'] as number) : undefined,
        estimatedValue: normalizeText(leadPayload['estimatedValue'] as string | undefined),
        currency: normalizeText(leadPayload['currency'] as string | undefined) ?? undefined,
        metadata: {
          ingestionSource: source,
          rawLead: leadPayload,
          rawEventType: input.payload['eventType'] ?? null
        },
        createdByUserId: null
      });

      await this.repo.attachIntegrationEventToLead(event.id, captured.id, workspaceId);
      await this.repo.markIntegrationEventStatus(event.id, 'PROCESSED');

      return {
        eventId: event.id,
        duplicate: false,
        leadId: captured.id
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown inbound lead webhook error';
      await this.repo.markIntegrationEventStatus(event.id, 'FAILED', message);
      throw error;
    }
  }

  public resolveIntegrationSource(source: string): LeadIntegrationSource {
    return resolveSource(source);
  }

  private async requireLead(workspaceId: string, leadId: string): Promise<Lead> {
    const lead = await this.repo.findLeadById(workspaceId, leadId);
    if (!lead) {
      throw new AppError('Lead not found', 404);
    }

    return lead;
  }

  private async createActivity(input: {
    workspaceId: string;
    leadId: string;
    actorUserId?: string | null;
    type: LeadActivityType;
    description?: string | null;
    payload?: Record<string, unknown>;
  }) {
    await this.repo.createActivity({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      title: toActivityTitle(input.type),
      description: normalizeText(input.description ?? undefined),
      payload: (input.payload as Prisma.InputJsonValue | undefined) ?? undefined,
      occurredAt: new Date()
    });
  }

  private assertWebhookAuthorization(headers: Record<string, string | undefined>): void {
    if (!this.webhookSecret) {
      return;
    }

    const provided =
      stripBearer(headers['x-leads-webhook-secret']) ??
      stripBearer(headers.authorization) ??
      stripBearer(headers['x-webhook-secret']);

    const expected = stripBearer(this.webhookSecret);
    if (!provided || !expected || provided !== expected) {
      throw new AppError('Lead webhook is not authorized', 401);
    }
  }
}
