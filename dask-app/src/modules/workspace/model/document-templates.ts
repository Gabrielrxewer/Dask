import type { DocumentKind, WorkspaceDocumentMetadata } from "@/modules/workspace/model/types";

export interface DocumentTemplate {
  title: string;
  content: string;
  metadata?: WorkspaceDocumentMetadata;
}

export const DOCUMENT_TEMPLATES: Record<DocumentKind, DocumentTemplate> = {
  wiki: {
    title: "Nova documentacao",
    content: `# Titulo da documentacao

## Visao geral

Descreva aqui o objetivo desta documentacao.

## Contexto

Explique o cenario, problema, processo ou regra que este documento registra.

## Detalhes

Adicione as informacoes principais, decisoes, exemplos, fluxos ou instrucoes.

## Referencias

- Link ou referencia 1
- Link ou referencia 2

## Observacoes para IA

Inclua aqui informacoes importantes para que a IA compreenda corretamente este conteudo.`
  },
  proposal: {
    title: "Nova proposta comercial",
    metadata: {
      clientLogoUrl: "",
      clientName: "",
      ownerName: "",
      proposalCode: "",
      proposalDate: "",
      proposalValidity: ""
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
| Responsavel comercial | {{ownerName}} |
| Data da proposta | {{proposalDate}} |
| Validade da proposta | {{proposalValidity}} |
| Codigo da proposta | {{proposalCode}} |

## 3. Objetivo

Descreva aqui o principal objetivo da proposta e o resultado esperado para o cliente.

## 4. Escopo da solucao

A solucao proposta contempla:

- Item 1 do escopo
- Item 2 do escopo
- Item 3 do escopo

## 5. Entregaveis

| Entregavel | Descricao | Responsavel |
|---|---|---|
| Entregavel 1 | Descricao do entregavel | Dask/Cliente |
| Entregavel 2 | Descricao do entregavel | Dask/Cliente |

## 6. Cronograma estimado

| Etapa | Descricao | Prazo estimado |
|---|---|---|
| Inicio | Alinhamento inicial e levantamento | X dias |
| Execucao | Desenvolvimento/configuracao da solucao | X dias |
| Validacao | Testes, ajustes e homologacao | X dias |
| Entrega | Publicacao, ativacao ou entrega final | X dias |

## 7. Investimento

| Item | Quantidade | Valor unitario | Valor total |
|---|---:|---:|---:|
| Servico/Produto 1 | 1 | R$ 0,00 | R$ 0,00 |
| Servico/Produto 2 | 1 | R$ 0,00 | R$ 0,00 |

**Valor total da proposta:** R$ 0,00

## 8. Condicoes comerciais

- Forma de pagamento: a definir
- Prazo de pagamento: a definir
- Validade da proposta: a definir
- Impostos: conforme legislacao aplicavel
- Reajustes: conforme condicoes acordadas

## 9. Premissas

Esta proposta considera as seguintes premissas:

- O cliente fornecera as informacoes necessarias para execucao.
- Mudancas de escopo poderao gerar reavaliacao de prazo e valor.
- Integracoes externas dependem da disponibilidade das APIs e servicos terceiros.

## 10. Fora do escopo

Nao estao incluidos nesta proposta:

- Item fora do escopo 1
- Item fora do escopo 2
- Item fora do escopo 3

## 11. Aceite da proposta

Ao aprovar esta proposta, o cliente declara estar de acordo com o escopo, valores, prazos e condicoes descritas neste documento.

| Nome | Cargo | Assinatura | Data |
|---|---|---|---|
|  |  |  |  |`
  },
  contract: {
    title: "Novo contrato",
    content: `# Contrato de Prestacao de Servicos

> Este modelo e uma base inicial e deve ser revisado por um profissional juridico antes do uso formal.

## 1. Partes

Pelo presente instrumento particular, de um lado:

**Contratante:** {{clientName}}, inscrito(a) no CPF/CNPJ sob no {{clientDocument}}, com endereco em {{clientAddress}}.

E, de outro lado:

**Contratada:** {{companyName}}, inscrita no CPF/CNPJ sob no {{companyDocument}}, com endereco em {{companyAddress}}.

As partes acima identificadas resolvem celebrar o presente contrato, conforme as clausulas e condicoes abaixo.

## 2. Objeto

O presente contrato tem como objeto a prestacao dos seguintes servicos:

- Servico 1
- Servico 2
- Servico 3

## 3. Escopo dos servicos

A Contratada se compromete a executar os servicos descritos abaixo:

| Servico | Descricao | Prazo estimado |
|---|---|---|
| Servico 1 | Descricao do servico | X dias |
| Servico 2 | Descricao do servico | X dias |

## 4. Obrigacoes da Contratada

Sao obrigacoes da Contratada:

- Executar os servicos conforme o escopo acordado.
- Manter comunicacao clara sobre o andamento das atividades.
- Informar impedimentos, riscos ou dependencias que possam impactar a entrega.
- Preservar a confidencialidade das informacoes recebidas.

## 5. Obrigacoes da Contratante

Sao obrigacoes da Contratante:

- Fornecer as informacoes necessarias para execucao dos servicos.
- Validar entregas dentro dos prazos acordados.
- Efetuar os pagamentos conforme as condicoes estabelecidas.
- Comunicar alteracoes de escopo ou prioridade.

## 6. Valores e forma de pagamento

Pela prestacao dos servicos, a Contratante pagara a Contratada os seguintes valores:

| Descricao | Valor |
|---|---:|
| Valor inicial | R$ 0,00 |
| Valor recorrente, se houver | R$ 0,00 |
| Outros valores | R$ 0,00 |

Forma de pagamento:

- Metodo: a definir
- Vencimento: a definir
- Recorrencia: a definir

## 7. Prazo de vigencia

O presente contrato tera inicio em {{startDate}} e permanecera vigente ate {{endDate}}, podendo ser renovado mediante acordo entre as partes.

## 8. Alteracoes de escopo

Qualquer alteracao de escopo devera ser formalizada entre as partes e podera gerar revisao de prazo, valores e condicoes comerciais.

## 9. Confidencialidade

As partes se comprometem a manter sigilo sobre informacoes tecnicas, comerciais, estrategicas, financeiras ou operacionais as quais tiverem acesso em razao deste contrato.

## 10. Rescisao

O contrato podera ser rescindido por qualquer uma das partes mediante aviso previo de {{noticePeriod}} dias, sem prejuizo dos valores devidos ate a data da rescisao.

## 11. Propriedade intelectual

A titularidade dos materiais, codigos, documentos, configuracoes ou entregaveis devera seguir o acordo definido entre as partes neste contrato ou em documento complementar.

## 12. Limitacao de responsabilidade

A responsabilidade das partes fica limitada aos danos diretos comprovadamente causados, excluindo-se lucros cessantes, danos indiretos ou prejuizos decorrentes de terceiros, salvo disposicao legal em contrario.

## 13. Foro

As partes elegem o foro da comarca de {{city}}/{{state}} para dirimir eventuais duvidas ou controversias oriundas deste contrato.

## 14. Assinaturas

E por estarem de acordo, as partes assinam o presente contrato.

| Parte | Nome | Assinatura | Data |
|---|---|---|---|
| Contratante |  |  |  |
| Contratada |  |  |  |`
  }
};

export function getDocumentTemplate(kind: DocumentKind): DocumentTemplate {
  return DOCUMENT_TEMPLATES[kind];
}
