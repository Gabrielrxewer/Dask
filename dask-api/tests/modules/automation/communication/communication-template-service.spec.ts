import { describe, expect, it, vi } from 'vitest';
import { CommunicationTemplateService } from '@/modules/automation/communication/communication-template-service';

const baseDate = new Date('2026-05-05T12:00:00.000Z');

function makePrisma() {
  const templates: any[] = [];
  const versions: any[] = [];
  const prisma = {
    communicationTemplate: {
      create: vi.fn(async ({ data }) => {
        const template = {
          id: `template-${templates.length + 1}`,
          createdAt: baseDate,
          updatedAt: baseDate,
          archivedAt: null,
          approvalStatus: 'draft',
          providerTemplateName: null,
          providerTemplateId: null,
          language: null,
          ...data
        };
        templates.push(template);
        return template;
      }),
      findMany: vi.fn(async () => templates),
      findUnique: vi.fn(async ({ where }) =>
        templates.find((entry) => entry.workspaceId === where.workspaceId_key.workspaceId && entry.key === where.workspaceId_key.key) ?? null
      ),
      findFirst: vi.fn(async ({ where }) =>
        templates.find((entry) => entry.id === where.id && entry.workspaceId === where.workspaceId) ?? null
      ),
      update: vi.fn(async ({ where, data }) => {
        const entry = templates.find((template) => template.id === where.id);
        Object.assign(entry, data);
        return entry;
      })
    },
    communicationTemplateVersion: {
      aggregate: vi.fn(async ({ where }) => ({
        _max: {
          version: Math.max(0, ...versions.filter((entry) => entry.templateId === where.templateId).map((entry) => entry.version))
        }
      })),
      create: vi.fn(async ({ data }) => {
        const version = {
          id: `version-${versions.length + 1}`,
          createdAt: baseDate,
          updatedAt: baseDate,
          publishedAt: null,
          publishedById: null,
          approvalStatus: 'draft',
          providerTemplateName: null,
          providerTemplateId: null,
          language: null,
          componentsJson: null,
          ...data
        };
        versions.push(version);
        return version;
      }),
      findFirst: vi.fn(async ({ where, include, orderBy }) => {
        let candidates = versions.filter((entry) => {
          if (where.id && entry.id !== where.id) return false;
          if (where.workspaceId && entry.workspaceId !== where.workspaceId) return false;
          if (where.status && entry.status !== where.status) return false;
          if (where.template?.key) {
            const template = templates.find((candidate) => candidate.id === entry.templateId);
            if (template?.key !== where.template.key) return false;
          }
          return true;
        });
        if (orderBy?.[0]?.version === 'desc') {
          candidates = candidates.sort((a, b) => b.version - a.version);
        }
        const version = candidates[0] ?? null;
        if (version && include?.template) {
          return { ...version, template: templates.find((entry) => entry.id === version.templateId) };
        }
        return version;
      }),
      update: vi.fn(async ({ where, data }) => {
        const entry = versions.find((version) => version.id === where.id);
        Object.assign(entry, data);
        return entry;
      })
    }
  };

  return { prisma, templates, versions, service: new CommunicationTemplateService(prisma as any) };
}

describe('CommunicationTemplateService', () => {
  it('creates templates, draft versions and publishes immutable versions', async () => {
    const { service } = makePrisma();
    const template = await service.createTemplate({
      workspaceId: 'ws-1',
      name: 'Proposal follow-up',
      key: 'proposal_followup',
      channel: 'email',
      category: 'follow_up'
    });
    const draft = await service.createDraftVersion({
      workspaceId: 'ws-1',
      templateId: template.id,
      subject: 'Olá {{contact.name}}',
      textBody: 'Sua proposta {{proposal.code}} está pronta.',
      variables: ['contact.name', 'proposal.code']
    });
    const published = await service.publishVersion({ workspaceId: 'ws-1', versionId: draft.id });

    expect(published.status).toBe('published');
    await expect(service.updateDraftVersion({
      workspaceId: 'ws-1',
      versionId: draft.id,
      subject: 'Mutating'
    })).rejects.toThrow('Published communication template versions are immutable.');
  });

  it('finds the latest published version by key and renders variables', async () => {
    const { service } = makePrisma();
    const template = await service.createTemplate({
      workspaceId: 'ws-1',
      name: 'Proposal follow-up',
      key: 'proposal_followup'
    });
    const draft = await service.createDraftVersion({
      workspaceId: 'ws-1',
      templateId: template.id,
      subject: 'Olá {{contact.name}}',
      textBody: 'Código {{proposal.code}}',
      htmlBody: '<p>Código {{proposal.code}}</p>',
      variables: ['contact.name', 'proposal.code']
    });
    await service.publishVersion({ workspaceId: 'ws-1', versionId: draft.id });

    const rendered = await service.renderPublishedTemplate({
      workspaceId: 'ws-1',
      templateKey: 'proposal_followup',
      context: {
        contact: { name: 'Maria' },
        proposal: { code: 'P-123' }
      }
    });

    expect(rendered).toMatchObject({
      subject: 'Olá Maria',
      text: 'Código P-123',
      html: '<p>Código P-123</p>',
      templateVersionId: draft.id
    });
  });

  it('fails when required variables are missing', async () => {
    const { service } = makePrisma();
    const template = await service.createTemplate({ workspaceId: 'ws-1', name: 'T', key: 't' });
    const draft = await service.createDraftVersion({
      workspaceId: 'ws-1',
      templateId: template.id,
      subject: 'Olá {{contact.name}}',
      variables: ['contact.name']
    });
    await service.publishVersion({ workspaceId: 'ws-1', versionId: draft.id });

    await expect(service.renderPublishedTemplate({
      workspaceId: 'ws-1',
      templateKey: 't',
      context: {}
    })).rejects.toThrow('Communication template variables are missing.');
  });

  it('creates, publishes, approves and renders WhatsApp templates', async () => {
    const { service } = makePrisma();
    const template = await service.createWhatsAppTemplate({
      workspaceId: 'ws-1',
      name: 'WhatsApp follow-up',
      key: 'proposal_followup_whatsapp',
      body: 'Ola {{contact.name}}, proposta {{proposal.code}}.',
      category: 'utility',
      language: 'pt_BR',
      variables: ['contact.name', 'proposal.code']
    });
    const draft = template.versions[0];
    await service.publishVersion({ workspaceId: 'ws-1', versionId: draft.id });

    await expect(service.renderApprovedWhatsAppTemplate({
      workspaceId: 'ws-1',
      templateVersionId: draft.id,
      context: {
        contact: { name: 'Maria' },
        proposal: { code: 'P-123' }
      }
    })).rejects.toThrow('WhatsApp template is not approved.');

    await service.markApprovalStatus({
      workspaceId: 'ws-1',
      versionId: draft.id,
      approvalStatus: 'approved',
      providerTemplateId: 'meta-template-1'
    });
    const rendered = await service.renderApprovedWhatsAppTemplate({
      workspaceId: 'ws-1',
      templateVersionId: draft.id,
      context: {
        contact: { name: 'Maria' },
        proposal: { code: 'P-123' }
      }
    });

    expect(rendered).toMatchObject({
      channel: 'whatsapp',
      approvalStatus: 'approved',
      providerTemplateId: 'meta-template-1',
      language: 'pt_BR',
      text: 'Ola Maria, proposta P-123.'
    });
  });
});
