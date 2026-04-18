import { AppError } from '@/core/errors/app-error';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import type {
  FiscalCancelResponse,
  FiscalDocumentStatusResponse,
  FiscalIssueRequest,
  FiscalIssueResponse,
  FiscalProvider,
  FiscalProviderCompanyConfig,
  FiscalReceivedDocumentPayload,
  FiscalReceivedSyncRequest,
  FiscalReceivedSyncResponse,
  FiscalWebhookParseResult
} from '@/modules/fiscal/providers/fiscal-provider';

interface FocusClientResponse {
  statusCode: number;
  headers: Headers;
  body: Record<string, unknown>;
}

function parseResponsePayload(raw: string): Record<string, unknown> {
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { data: parsed };
  } catch {
    return { raw };
  }
}

function buildFocusAuthorization(token: string): string {
  const normalized = token.trim();
  if (!normalized) {
    return '';
  }

  if (normalized.toLowerCase().startsWith('basic ')) {
    return normalized;
  }

  return `Basic ${Buffer.from(`${normalized}:`).toString('base64')}`;
}

function pickFirstString(source: Record<string, unknown>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const value = source[candidate];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function extractStatus(raw: Record<string, unknown>): string | null {
  return pickFirstString(raw, ['status', 'situacao', 'codigo_status', 'status_sefaz']);
}

function extractXmlUrl(raw: Record<string, unknown>): string | null {
  return pickFirstString(raw, [
    'caminho_xml_nota_fiscal',
    'url_xml',
    'xml_url',
    'xml'
  ]);
}

function extractPdfUrl(raw: Record<string, unknown>): string | null {
  return pickFirstString(raw, ['caminho_danfe', 'url_danfe', 'pdf_url', 'pdf']);
}

function extractReference(raw: Record<string, unknown>): string | null {
  return pickFirstString(raw, ['referencia', 'ref', 'reference']);
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export class FocusFiscalProvider implements FiscalProvider {
  private readonly baseUrl: string;

  public constructor(baseUrl = env.FOCUS_API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async issueNfe(input: FiscalIssueRequest): Promise<FiscalIssueResponse> {
    const response = await this.request(input.company, {
      method: 'POST',
      path: '/nfe',
      query: {
        ref: input.reference
      },
      body: input.payload
    });

    return {
      reference: input.reference,
      providerStatus: extractStatus(response.body),
      providerDocumentId: pickFirstString(response.body, ['chave', 'chave_nfe', 'id']),
      xmlUrl: extractXmlUrl(response.body),
      pdfUrl: extractPdfUrl(response.body),
      raw: response.body
    };
  }

  public async issueNfse(input: FiscalIssueRequest): Promise<FiscalIssueResponse> {
    const response = await this.request(input.company, {
      method: 'POST',
      path: '/nfse',
      query: {
        ref: input.reference
      },
      body: input.payload
    });

    return {
      reference: input.reference,
      providerStatus: extractStatus(response.body),
      providerDocumentId: pickFirstString(response.body, ['chave', 'chave_nfse', 'id']),
      xmlUrl: extractXmlUrl(response.body),
      pdfUrl: extractPdfUrl(response.body),
      raw: response.body
    };
  }

  public async getDocumentStatus(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: 'NFE' | 'NFSE';
  }): Promise<FiscalDocumentStatusResponse> {
    const pathPrefix = input.documentType === 'NFE' ? '/nfe' : '/nfse';
    const response = await this.request(input.company, {
      method: 'GET',
      path: `${pathPrefix}/${encodeURIComponent(input.reference)}`
    });

    return {
      reference: input.reference,
      providerStatus: extractStatus(response.body),
      providerDocumentId: pickFirstString(response.body, ['chave', 'chave_nfe', 'chave_nfse', 'id']),
      xmlUrl: extractXmlUrl(response.body),
      pdfUrl: extractPdfUrl(response.body),
      raw: response.body
    };
  }

  public async cancelDocument(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: 'NFE' | 'NFSE';
    justification?: string;
  }): Promise<FiscalCancelResponse> {
    const pathPrefix = input.documentType === 'NFE' ? '/nfe' : '/nfse';
    const response = await this.request(input.company, {
      method: 'POST',
      // Focus cancels documents through /cancelamento on both NFe and NFSe endpoints.
      path: `${pathPrefix}/${encodeURIComponent(input.reference)}/cancelamento`,
      body: input.justification
        ? {
            justificativa: input.justification
          }
        : {}
    });

    return {
      reference: input.reference,
      providerStatus: extractStatus(response.body),
      raw: response.body
    };
  }

  public async downloadXml(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: 'NFE' | 'NFSE';
  }): Promise<{ url: string | null; raw: Record<string, unknown> }> {
    const status = await this.getDocumentStatus(input);
    return {
      url: status.xmlUrl ?? null,
      raw: status.raw
    };
  }

  public async downloadPdf(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: 'NFE' | 'NFSE';
  }): Promise<{ url: string | null; raw: Record<string, unknown> }> {
    const status = await this.getDocumentStatus(input);
    return {
      url: status.pdfUrl ?? null,
      raw: status.raw
    };
  }

  public async syncReceivedNfe(input: FiscalReceivedSyncRequest): Promise<FiscalReceivedSyncResponse> {
    const response = await this.request(input.company, {
      method: 'GET',
      path: '/nfe_recebidas',
      query: {
        cnpj: input.company.cnpj,
        versao: input.version ?? 0,
        completa: input.full ? 1 : 0
      }
    });

    const itemsArray = Array.isArray(response.body.items)
      ? response.body.items
      : Array.isArray(response.body.nfes)
        ? response.body.nfes
        : Array.isArray(response.body)
          ? (response.body as unknown[])
          : [];

    return {
      type: 'NFE_MDE',
      items: itemsArray.map((item) => this.mapReceivedItem(toRecord(item))),
      maxVersion: toNumberOrNull(response.headers.get('x-max-version')) ?? undefined,
      totalCount: toNumberOrNull(response.headers.get('x-total-count')) ?? undefined,
      rawHeaders: {
        'x-max-version': response.headers.get('x-max-version'),
        'x-total-count': response.headers.get('x-total-count')
      }
    };
  }

  public async syncReceivedNfse(input: FiscalReceivedSyncRequest): Promise<FiscalReceivedSyncResponse> {
    const response = await this.request(input.company, {
      method: 'GET',
      path: '/nfsens_recebidas',
      query: {
        cnpj: input.company.cnpj,
        versao: input.version ?? 0,
        completa: input.full ? 1 : 0
      }
    });

    const itemsArray = Array.isArray(response.body.items)
      ? response.body.items
      : Array.isArray(response.body.nfses)
        ? response.body.nfses
        : Array.isArray(response.body)
          ? (response.body as unknown[])
          : [];

    return {
      type: 'NFSE_NFSER',
      items: itemsArray.map((item) => this.mapReceivedItem(toRecord(item))),
      maxVersion: toNumberOrNull(response.headers.get('x-max-version')) ?? undefined,
      totalCount: toNumberOrNull(response.headers.get('x-total-count')) ?? undefined,
      rawHeaders: {
        'x-max-version': response.headers.get('x-max-version'),
        'x-total-count': response.headers.get('x-total-count')
      }
    };
  }

  public handleWebhook(payload: Record<string, unknown>): FiscalWebhookParseResult {
    const eventType = pickFirstString(payload, ['evento', 'event', 'evento_tipo', 'tipo']) ?? 'unknown';
    const documentReference =
      pickFirstString(payload, ['referencia', 'ref', 'referencia_nota']) ??
      extractReference(payload);
    const workspaceId = pickFirstString(payload, ['workspace_id', 'workspaceId']);
    const companyReference = pickFirstString(payload, ['empresa', 'company_reference', 'focus_company_reference']);

    return {
      sourceEventId: pickFirstString(payload, ['id', 'evento_id', 'event_id']),
      eventType,
      workspaceId,
      companyReference,
      documentReference,
      documentType: eventType.toLowerCase().includes('nfse') ? 'NFSE' : 'NFE',
      raw: payload
    };
  }

  public async registerCompany(input: {
    company: FiscalProviderCompanyConfig;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const response = await this.request(input.company, {
      method: 'POST',
      path: '/empresas',
      body: input.payload
    });

    return response.body;
  }

  public async validateCompanyConfig(input: {
    company: FiscalProviderCompanyConfig;
  }): Promise<{ ok: boolean; details: Record<string, unknown> }> {
    try {
      const response = await this.request(input.company, {
        method: 'GET',
        path: '/nfe_recebidas',
        query: {
          cnpj: input.company.cnpj,
          versao: 0
        }
      });

      return {
        ok: response.statusCode >= 200 && response.statusCode < 300,
        details: {
          statusCode: response.statusCode,
          body: response.body
        }
      };
    } catch (error) {
      return {
        ok: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown Focus API error'
        }
      };
    }
  }

  private async request(
    company: FiscalProviderCompanyConfig,
    input: {
      method: 'GET' | 'POST';
      path: string;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    }
  ): Promise<FocusClientResponse> {
    const url = new URL(`${this.baseUrl}${input.path}`);

    if (input.query) {
      Object.entries(input.query).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    const authorization = buildFocusAuthorization(company.token);
    if (!authorization) {
      throw new AppError('Focus token is missing in fiscal company config', 422);
    }

    const headers: Record<string, string> = {
      Authorization: authorization,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: input.method,
      headers,
      body: input.method === 'GET' ? undefined : JSON.stringify(input.body ?? {})
    });

    const rawText = await response.text();
    const parsed = parseResponsePayload(rawText);

    if (!response.ok) {
      logger.warn(
        {
          event: 'fiscal.focus.request_failed',
          method: input.method,
          path: input.path,
          statusCode: response.status,
          body: parsed
        },
        'Focus API request failed'
      );

      throw new AppError(
        `Focus API request failed (${response.status})`,
        response.status >= 500 ? 502 : response.status,
        {
          details: parsed
        }
      );
    }

    return {
      statusCode: response.status,
      headers: response.headers,
      body: parsed
    };
  }

  private mapReceivedItem(item: Record<string, unknown>): FiscalReceivedDocumentPayload {
    return {
      externalKey:
        pickFirstString(item, ['chave', 'chave_nfe', 'chave_nfse']) ??
        pickFirstString(item, ['id']) ??
        `focus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      providerReference: pickFirstString(item, ['referencia', 'ref']),
      focusReference: pickFirstString(item, ['referencia', 'ref']),
      manifestationStatus: pickFirstString(item, ['manifestacao', 'status_manifestacao']),
      issuerName: pickFirstString(item, ['nome_emitente', 'razao_social_emitente', 'prestador_nome']),
      issuerDocument: pickFirstString(item, ['cnpj_emitente', 'cpf_emitente', 'prestador_documento']),
      recipientDocument: pickFirstString(item, ['cnpj_destinatario', 'cpf_destinatario', 'tomador_documento']),
      amountTotal: toNumberOrNull(item.valor_total) ?? toNumberOrNull(item.valor),
      issuedAt: pickFirstString(item, ['data_emissao', 'emissao', 'data']),
      receivedAt: pickFirstString(item, ['data_recebimento', 'recebido_em']),
      xmlUrl: pickFirstString(item, ['url_xml', 'caminho_xml', 'xml_url']),
      pdfUrl: pickFirstString(item, ['url_pdf', 'caminho_pdf', 'pdf_url']),
      raw: item
    };
  }
}
