type CommercialDocumentKind = 'wiki' | 'proposal' | 'contract';

export type CommercialDocumentTemplate = {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
};

const proposalTemplate: CommercialDocumentTemplate = {
  title: 'Proposta Comercial',
  metadata: {
    status: 'draft',
    clientLogoUrl: '',
    clientName: '',
    ownerName: '',
    proposalCode: '',
    proposalDate: '',
    proposalValidity: ''
  },
  content: `![Logo do cliente]({{clientLogoUrl}})

# Proposta Comercial

## 1. Apresentacao

Ola, **{{clientName}}**.

Apresentamos esta proposta com o objetivo de formalizar a solucao, escopo, condicoes comerciais e proximos passos para o projeto descrito abaixo.

## 2. Dados da proposta

| Campo | Informacao |
|---|---|
| Cliente | {{clientName}} |
| Razao social / nome legal | {{clientLegalName}} |
| Contato principal | {{contactName}} |
| E-mail do contato | {{contactEmail}} |
| Telefone do contato | {{contactPhone}} |
| Responsavel comercial | {{ownerName}} |
| Data da proposta | {{proposalDate}} |
| Validade da proposta | {{proposalValidity}} |
| Codigo da proposta | {{proposalCode}} |
| Origem comercial | {{commercialSource}} |

## 3. Objetivo

{{dealDescription}}

## 4. Escopo da solucao

{{implementationScope}}

{{catalogItemDescription}}

## 5. Entregaveis

{{deliverables}}

## 6. Cronograma estimado

{{deliveryTerms}}

## 7. Investimento

**Valor total da proposta:** {{dealValue}}

| Item | Quantidade | Unidade | Valor |
|---|---:|---|---:|
| {{catalogItemName}} | {{catalogItemDefaultQuantity}} | {{catalogItemUnit}} | {{catalogItemAmount}} |

## 8. Condicoes comerciais

{{paymentTerms}}

## 9. Premissas

{{clientResponsibilities}}

- Mudancas de escopo poderao gerar reavaliacao de prazo e valor.
- Integracoes externas dependem da disponibilidade das APIs e servicos terceiros.

## 10. Fora do escopo

{{outOfScope}}

## 11. Aceite da proposta

Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, valores, prazos e condicoes descritas neste documento.

{{acceptanceCriteria}}

| Nome | Cargo | Assinatura | Data |
|---|---|---|---|
|  |  |  |  |`
};

const contractTemplate: CommercialDocumentTemplate = {
  title: 'Contrato de Prestacao de Servicos',
  metadata: {
    status: 'draft'
  },
  content: `# Contrato de Prestacao de Servicos

> Este modelo e uma base inicial e deve ser revisado por um profissional juridico antes do uso formal.

## 1. Partes

**Contratante:** {{clientLegalName}}, inscrito(a) no CPF/CNPJ sob no {{clientDocument}}, com endereco em {{clientAddress}}.

**Contratada:** {{providerName}}, inscrita no CPF/CNPJ sob no {{providerDocument}}, com endereco em {{providerAddress}}.

As partes acima identificadas resolvem celebrar o presente contrato, conforme as clausulas e condicoes abaixo.

## 2. Objeto

{{implementationScope}}

## 3. Escopo dos servicos

| Servico/Produto | Quantidade | Unidade | Prazo |
|---|---:|---|---|
| {{catalogItemName}} | {{catalogItemDefaultQuantity}} | {{catalogItemUnit}} | {{deliveryTerms}} |

{{deliverables}}

## 4. Valores e forma de pagamento

Valor contratado: {{dealValue}}

Condicoes comerciais:

{{paymentTerms}}

## 5. Vigencia

O presente contrato tera inicio em {{startDate}} e permanecera vigente por {{contractTerm}}, podendo ser renovado mediante acordo entre as partes.

## 6. Alteracoes de escopo

Qualquer alteracao de escopo devera ser formalizada entre as partes e podera gerar revisao de prazo, valores e condicoes comerciais.

## 7. Responsabilidades e aceite

Responsabilidades do cliente:

{{clientResponsibilities}}

Criterios de aceite:

{{acceptanceCriteria}}

## 8. Cancelamento e rescisao

{{cancellationTerms}}

Aviso previo minimo para rescisao: {{noticePeriod}}.

## 9. Confidencialidade

As partes se comprometem a manter sigilo sobre informacoes tecnicas, comerciais, estrategicas, financeiras ou operacionais as quais tiverem acesso em razao deste contrato.

## 10. Observacoes contratuais

{{contractNotes}}

## 11. Foro

As partes elegem o foro da comarca de {{city}}/{{state}} para dirimir eventuais duvidas ou controversias oriundas deste contrato.

## 12. Assinaturas

| Parte | Nome | Assinatura | Data |
|---|---|---|---|
| Contratante |  |  |  |
| Contratada |  |  |  |`
};

const wikiTemplate: CommercialDocumentTemplate = {
  title: 'Anotacoes comerciais',
  content: `# Anotacoes comerciais

## Contexto

Registre aqui decisoes, historico e informacoes internas sobre este WorkItem.`
};

export function getCommercialDocumentTemplate(kind: CommercialDocumentKind): CommercialDocumentTemplate {
  if (kind === 'proposal') {
    return proposalTemplate;
  }

  if (kind === 'contract') {
    return contractTemplate;
  }

  return wikiTemplate;
}
