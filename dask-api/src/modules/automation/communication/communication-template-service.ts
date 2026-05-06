import type {
  CommunicationTemplate,
  CommunicationTemplateVersion,
  Prisma,
  PrismaClient
} from '@prisma/client';
import { AppError } from '@/core/errors/app-error';

export type CommunicationTemplateCategory =
  | 'transactional'
  | 'follow_up'
  | 'marketing'
  | 'billing'
  | 'system'
  | 'utility'
  | 'authentication'
  | 'service'
  | string;

export type WhatsAppTemplateApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled';

export type RenderedCommunicationTemplate = {
  templateId: string;
  templateVersionId: string;
  category: string;
  channel: string;
  approvalStatus?: string;
  providerTemplateName?: string | null;
  providerTemplateId?: string | null;
  language?: string | null;
  subject?: string;
  text?: string;
  html?: string;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: string | null | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new AppError(`${label} is required.`, 422);
  }

  return trimmed;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
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

function extractVariables(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const variables = new Set<string>();
  for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

function renderBody(
  value: string | null | undefined,
  context: Record<string, unknown>,
  missing: Set<string>
): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const resolved = readPath(context, path);
    if (resolved === undefined || resolved === null) {
      missing.add(path);
      return '';
    }

    return String(resolved);
  });
}

function declaredVariables(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (isRecord(entry) && typeof entry.key === 'string') {
        return entry.key.trim();
      }
      return '';
    })
    .filter(Boolean);
}

export class CommunicationTemplateService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createTemplate(input: {
    workspaceId: string;
    name: string;
    key: string;
    channel?: string;
    category?: CommunicationTemplateCategory;
    description?: string | null;
    createdById?: string | null;
    providerTemplateName?: string | null;
    providerTemplateId?: string | null;
    language?: string | null;
    approvalStatus?: WhatsAppTemplateApprovalStatus;
  }): Promise<CommunicationTemplate> {
    const channel = input.channel?.trim().toLowerCase() ?? 'email';
    return this.prisma.communicationTemplate.create({
      data: {
        workspaceId: normalizeText(input.workspaceId, 'workspaceId'),
        name: normalizeText(input.name, 'name'),
        key: normalizeText(input.key, 'key'),
        channel,
        category: input.category?.trim() ?? 'follow_up',
        description: input.description?.trim() || null,
        providerTemplateName: input.providerTemplateName?.trim() || null,
        providerTemplateId: input.providerTemplateId?.trim() || null,
        language: input.language?.trim() || (channel === 'whatsapp' ? 'pt_BR' : null),
        approvalStatus: input.approvalStatus ?? 'draft',
        createdById: input.createdById ?? null
      }
    });
  }

  public async createWhatsAppTemplate(input: {
    workspaceId: string;
    name: string;
    key: string;
    body: string;
    category?: CommunicationTemplateCategory;
    language?: string;
    variables?: unknown;
    components?: unknown;
    providerTemplateName?: string | null;
    createdById?: string | null;
  }): Promise<CommunicationTemplate & { versions: CommunicationTemplateVersion[] }> {
    const template = await this.createTemplate({
      workspaceId: input.workspaceId,
      name: input.name,
      key: input.key,
      channel: 'whatsapp',
      category: input.category ?? 'utility',
      language: input.language ?? 'pt_BR',
      providerTemplateName: input.providerTemplateName ?? input.key,
      createdById: input.createdById
    });
    const version = await this.createDraftVersion({
      workspaceId: input.workspaceId,
      templateId: template.id,
      textBody: input.body,
      variables: input.variables,
      components: input.components,
      language: input.language ?? 'pt_BR',
      approvalStatus: 'draft',
      providerTemplateName: input.providerTemplateName ?? input.key
    });

    return {
      ...template,
      versions: [version]
    };
  }

  public async listTemplates(input: {
    workspaceId: string;
    channel?: string;
    status?: string;
    limit?: number;
  }): Promise<CommunicationTemplate[]> {
    return this.prisma.communicationTemplate.findMany({
      where: {
        workspaceId: input.workspaceId,
        channel: input.channel,
        status: input.status
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: Math.min(Math.max(input.limit ?? 100, 1), 500)
    });
  }

  public async findTemplateByKey(input: {
    workspaceId: string;
    key: string;
  }): Promise<CommunicationTemplate | null> {
    return this.prisma.communicationTemplate.findUnique({
      where: {
        workspaceId_key: {
          workspaceId: input.workspaceId,
          key: input.key
        }
      }
    });
  }

  public async createDraftVersion(input: {
    workspaceId: string;
    templateId: string;
    subject?: string | null;
    textBody?: string | null;
    htmlBody?: string | null;
    variables?: unknown;
    metadata?: unknown;
    components?: unknown;
    approvalStatus?: WhatsAppTemplateApprovalStatus;
    providerTemplateName?: string | null;
    providerTemplateId?: string | null;
    language?: string | null;
  }): Promise<CommunicationTemplateVersion> {
    const template = await this.prisma.communicationTemplate.findFirst({
      where: {
        id: input.templateId,
        workspaceId: input.workspaceId,
        archivedAt: null
      },
      select: { id: true, channel: true, language: true, providerTemplateName: true, providerTemplateId: true }
    });
    if (!template) {
      throw new AppError('Communication template not found.', 404);
    }

    const aggregate = await this.prisma.communicationTemplateVersion.aggregate({
      where: { templateId: input.templateId },
      _max: { version: true }
    });

    return this.prisma.communicationTemplateVersion.create({
      data: {
        workspaceId: input.workspaceId,
        templateId: input.templateId,
        version: (aggregate._max.version ?? 0) + 1,
        status: 'draft',
        approvalStatus: input.approvalStatus ?? 'draft',
        providerTemplateName: input.providerTemplateName ?? template.providerTemplateName,
        providerTemplateId: input.providerTemplateId ?? template.providerTemplateId,
        language: input.language ?? template.language,
        componentsJson: input.components !== undefined ? toJsonValue(input.components) : undefined,
        subject: input.subject ?? null,
        textBody: input.textBody ?? null,
        htmlBody: input.htmlBody ?? null,
        variablesJson: input.variables !== undefined ? toJsonValue(input.variables) : undefined,
        metadataJson: input.metadata !== undefined ? toJsonValue(input.metadata) : undefined
      }
    });
  }

  public async updateDraftVersion(input: {
    workspaceId: string;
    versionId: string;
    subject?: string | null;
    textBody?: string | null;
    htmlBody?: string | null;
    variables?: unknown;
    metadata?: unknown;
    components?: unknown;
    approvalStatus?: WhatsAppTemplateApprovalStatus;
    providerTemplateName?: string | null;
    providerTemplateId?: string | null;
    language?: string | null;
  }): Promise<CommunicationTemplateVersion> {
    const version = await this.prisma.communicationTemplateVersion.findFirst({
      where: {
        id: input.versionId,
        workspaceId: input.workspaceId
      }
    });
    if (!version) {
      throw new AppError('Communication template version not found.', 404);
    }
    if (version.status === 'published') {
      throw new AppError('Published communication template versions are immutable.', 409);
    }

    return this.prisma.communicationTemplateVersion.update({
      where: { id: version.id },
      data: {
        subject: input.subject ?? undefined,
        approvalStatus: input.approvalStatus ?? undefined,
        providerTemplateName: input.providerTemplateName ?? undefined,
        providerTemplateId: input.providerTemplateId ?? undefined,
        language: input.language ?? undefined,
        componentsJson: input.components !== undefined ? toJsonValue(input.components) : undefined,
        textBody: input.textBody ?? undefined,
        htmlBody: input.htmlBody ?? undefined,
        variablesJson: input.variables !== undefined ? toJsonValue(input.variables) : undefined,
        metadataJson: input.metadata !== undefined ? toJsonValue(input.metadata) : undefined
      }
    });
  }

  public async publishVersion(input: {
    workspaceId: string;
    versionId: string;
    publishedById?: string | null;
  }): Promise<CommunicationTemplateVersion> {
    const version = await this.prisma.communicationTemplateVersion.findFirst({
      where: {
        id: input.versionId,
        workspaceId: input.workspaceId
      },
      include: { template: true }
    });
    if (!version) {
      throw new AppError('Communication template version not found.', 404);
    }
    if (version.status === 'published') {
      return version;
    }

    const bodyVariables = new Set([
      ...extractVariables(version.subject),
      ...extractVariables(version.textBody),
      ...extractVariables(version.htmlBody)
    ]);
    const declared = declaredVariables(version.variablesJson);
    const variables = declared.length > 0 ? declared : Array.from(bodyVariables);

    const published = await this.prisma.communicationTemplateVersion.update({
      where: { id: version.id },
      data: {
        status: 'published',
        variablesJson: toJsonValue(variables),
        publishedAt: new Date(),
        publishedById: input.publishedById ?? null
      }
    });

    await this.prisma.communicationTemplate.update({
      where: { id: version.templateId },
      data: { status: 'active' }
    });

    return published;
  }

  public async markApprovalStatus(input: {
    workspaceId: string;
    versionId: string;
    approvalStatus: WhatsAppTemplateApprovalStatus;
    providerTemplateId?: string | null;
    providerTemplateName?: string | null;
  }): Promise<CommunicationTemplateVersion> {
    const version = await this.prisma.communicationTemplateVersion.findFirst({
      where: {
        id: input.versionId,
        workspaceId: input.workspaceId
      },
      include: { template: true }
    });
    if (!version) {
      throw new AppError('Communication template version not found.', 404);
    }
    if (version.template.channel !== 'whatsapp') {
      throw new AppError('Only WhatsApp templates use provider approval status.', 422);
    }

    const updated = await this.prisma.communicationTemplateVersion.update({
      where: { id: version.id },
      data: {
        approvalStatus: input.approvalStatus,
        providerTemplateId: input.providerTemplateId ?? undefined,
        providerTemplateName: input.providerTemplateName ?? undefined
      }
    });

    await this.prisma.communicationTemplate.update({
      where: { id: version.templateId },
      data: {
        approvalStatus: input.approvalStatus,
        providerTemplateId: input.providerTemplateId ?? undefined,
        providerTemplateName: input.providerTemplateName ?? undefined
      }
    });

    return updated;
  }

  public async getPublishedVersion(input: {
    workspaceId: string;
    templateKey?: string | null;
    templateVersionId?: string | null;
  }): Promise<CommunicationTemplateVersion & { template: CommunicationTemplate }> {
    const version = input.templateVersionId
      ? await this.prisma.communicationTemplateVersion.findFirst({
          where: {
            id: input.templateVersionId,
            workspaceId: input.workspaceId,
            status: 'published'
          },
          include: { template: true }
        })
      : await this.prisma.communicationTemplateVersion.findFirst({
          where: {
            workspaceId: input.workspaceId,
            status: 'published',
            template: {
              key: normalizeText(input.templateKey, 'templateKey'),
              archivedAt: null
            }
          },
          include: { template: true },
          orderBy: [{ version: 'desc' }]
        });

    if (!version) {
      throw new AppError('Published communication template version not found.', 404);
    }

    return version;
  }

  public async getApprovedWhatsAppVersion(input: {
    workspaceId: string;
    templateKey?: string | null;
    templateVersionId?: string | null;
  }): Promise<CommunicationTemplateVersion & { template: CommunicationTemplate }> {
    const version = await this.getPublishedVersion(input);
    if (version.template.channel !== 'whatsapp') {
      throw new AppError('Communication template is not a WhatsApp template.', 422, {
        templateVersionId: version.id
      });
    }
    if (version.approvalStatus !== 'approved') {
      throw new AppError('WhatsApp template is not approved.', 422, {
        templateVersionId: version.id,
        approvalStatus: version.approvalStatus
      });
    }

    return version;
  }

  public async renderPublishedTemplate(input: {
    workspaceId: string;
    templateKey?: string | null;
    templateVersionId?: string | null;
    context: Record<string, unknown>;
  }): Promise<RenderedCommunicationTemplate> {
    const version = await this.getPublishedVersion(input);
    const required = declaredVariables(version.variablesJson);
    const missing = new Set<string>();
    const subject = renderBody(version.subject, input.context, missing);
    const text = renderBody(version.textBody, input.context, missing);
    const html = renderBody(version.htmlBody, input.context, missing);

    for (const variable of required) {
      if (readPath(input.context, variable) === undefined || readPath(input.context, variable) === null) {
        missing.add(variable);
      }
    }

    if (missing.size > 0) {
      throw new AppError('Communication template variables are missing.', 422, {
        missingVariables: Array.from(missing).sort(),
        templateVersionId: version.id
      });
    }

    return {
      templateId: version.templateId,
      templateVersionId: version.id,
      category: version.template.category,
      channel: version.template.channel,
      approvalStatus: version.approvalStatus,
      providerTemplateName: version.providerTemplateName ?? version.template.providerTemplateName,
      providerTemplateId: version.providerTemplateId ?? version.template.providerTemplateId,
      language: version.language ?? version.template.language,
      subject,
      text,
      html
    };
  }

  public async renderApprovedWhatsAppTemplate(input: {
    workspaceId: string;
    templateKey?: string | null;
    templateVersionId?: string | null;
    context: Record<string, unknown>;
  }): Promise<RenderedCommunicationTemplate> {
    const version = await this.getApprovedWhatsAppVersion(input);
    return this.renderPublishedTemplate({
      workspaceId: input.workspaceId,
      templateVersionId: version.id,
      context: input.context
    });
  }

  public async archiveTemplate(input: {
    workspaceId: string;
    templateId: string;
  }): Promise<CommunicationTemplate> {
    return this.prisma.communicationTemplate.update({
      where: { id: input.templateId },
      data: {
        status: 'archived',
        archivedAt: new Date()
      }
    });
  }
}
