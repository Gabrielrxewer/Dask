# Dask — Documentação Consolidada de Regras de Negócio

> Versão consolidada a partir das decisões e respostas fornecidas na conversa.  
> Esta documentação separa **regras de negócio confirmadas**, **decisões arquiteturais associadas** e **pontos condicionais/pendentes**.

---

## 1. Princípios gerais do produto

### 1.1 O Dask deve ser configurável por workspace

Cada workspace pode ter sua própria configuração de:

- tipos de WorkItem;
- campos dinâmicos;
- layouts de card, detail, form e list;
- estados de workflow;
- perspectivas de board;
- configurações fiscais;
- cobranças;
- automações;
- documentos;
- jornadas de marketing;
- agentes de IA.

A configuração não deve ser global fixa para todos os workspaces, exceto quando for infraestrutura compartilhada do produto.

### 1.2 WorkItem é o núcleo operacional do produto

O WorkItem é a entidade central para tarefas, leads, sinais, agendamentos, fluxo comercial, listas e board.

Regra central:

```txt
WorkItem = unidade operacional oficial do Dask.
```

Isso significa que:

- Board visualiza WorkItems.
- List lista WorkItems.
- Agenda agenda WorkItems.
- Leads são WorkItems comerciais.
- Signals são WorkItems.
- Documentos podem ser vinculados a WorkItems.
- Marketing pode segmentar WorkItems comerciais.
- Automações podem disparar ou alterar WorkItems.
- Cobranças podem estar vinculadas a WorkItems/Leads.

### 1.3 Evitar domínios paralelos quando WorkItem já resolve

Não deve existir um domínio paralelo como fonte oficial quando o WorkItem já representa aquela realidade de negócio.

Exemplo crítico:

```txt
Lead oficial = WorkItem comercial.
```

Se existir uma tabela/serviço legado de `Lead`, ele não deve competir com WorkItems como fonte de verdade. Ele deve ser:

- removido;
- adaptado;
- usado como façade;
- ou marcado como legado.

### 1.4 Configuração deve ser versionada

Sempre que o usuário configurar estruturas que afetam dados reais, deve haver versionamento.

Exemplos:

- schema público de WorkItems;
- campos comerciais;
- templates comerciais;
- layout de card/detail/form/list;
- transformação de WorkItemType;
- jornadas de marketing;
- automações;
- agentes de IA;
- documentos comerciais aceitos.

### 1.5 Auditoria é necessária em mudanças sensíveis

Deve haver histórico/auditoria para mudanças em:

- board config;
- campos;
- estados;
- WorkItem schema;
- layouts;
- transformações de tipo;
- jornadas;
- automações;
- AI agents;
- billing;
- fiscal;
- documentos comerciais;
- aceite/recusa de documentos;
- criação/conversão de clientes;
- criação de cobrança com justificativa;
- alterações críticas via automação.

---

## 2. WorkItems, schema público e campos dinâmicos

### 2.1 Campos dinâmicos devem virar schema público/JSON persistido

Os campos dinâmicos não devem ser apenas lógica interna do front-end.

Eles devem existir como schema público, persistido e versionado.

Regra:

```txt
Campos dinâmicos de WorkItem devem ser schema público/JSON persistido.
```

Isso permite:

- builder visual;
- formulários dinâmicos;
- validação frontend/backend;
- versionamento;
- auditoria;
- API externa;
- migração segura;
- configuração por usuário/admin;
- renderização de forms/list/card/detail.

### 2.2 O usuário pode adicionar novos campos

O usuário deve conseguir adicionar campos aos WorkItems.

Regra:

```txt
Usuários/admins podem adicionar novos campos aos tipos de WorkItem.
```

Esses campos devem ser renderizados nos formulários, listas, cards e detalhes de acordo com o schema/configuração.

### 2.3 WorkItem Editor deve evoluir para builder completo

O editor de WorkItem deve evoluir futuramente para um builder completo de:

- formulário;
- layout de card;
- layout de detail;
- layout de list;
- campos;
- regras de validação;
- condições;
- possivelmente visualização/preview.

Regra:

```txt
WorkItem Editor deve evoluir para builder completo de formulário, card e detalhe.
```

### 2.4 Formulário oficial de WorkItem

O formulário oficial de WorkItem deve ser a infraestrutura de `work-item-form`.

Regra:

```txt
O WorkItem é o form oficial.
```

Isso significa:

- outros módulos não devem criar formulários paralelos para o mesmo dado;
- Agenda, List, Leads e Board devem editar WorkItems pela infra oficial;
- modais/detalhes devem renderizar a partir do schema;
- campos dinâmicos devem respeitar o schema.

### 2.5 `billing_summary` é configurável pelo usuário

O campo/tipo `billing_summary` deve ser configurável pelo usuário.

Regra:

```txt
billing_summary deve ser tipo configurável pelo usuário.
```

Ele deve estar alinhado entre front-end e backend, e não pode existir em um lado sem ser aceito no outro.

### 2.6 WorkItemType transformation

Deve existir suporte para transformar um WorkItem de um tipo em outro.

Regra:

```txt
Um WorkItemType pode se transformar em outro WorkItemType sem perder dados.
```

Exemplo:

```txt
Signal → Lead
```

Regra de compatibilidade:

```txt
O tipo destino precisa conter todos os campos do tipo origem.
O tipo destino pode conter campos adicionais.
```

Exemplo permitido:

```txt
Signal:
- nome
- telefone
- origem
- mensagem

Lead:
- nome
- telefone
- origem
- mensagem
- valor estimado
- responsável
- próximo contato
```

Exemplo bloqueado:

```txt
Signal possui "mensagem"
Lead não possui "mensagem"
```

Nesse caso, a transformação deve ser bloqueada ou exigir uma estratégia explícita de mapeamento.

### 2.7 Transformação preserva o mesmo WorkItem

Preferencialmente, a transformação deve manter o mesmo WorkItem e alterar seu tipo.

Regra:

```txt
Transformação de tipo deve preservar histórico, dados, origem e identidade operacional do WorkItem.
```

Ela não deve criar um novo WorkItem apagando o anterior, salvo se houver uma regra explícita e auditada.

---

## 3. Board

### 3.1 Board precisa escalar

O board deve suportar centenas ou milhares de cards por workspace.

Regra:

```txt
Board deve suportar alto volume de cards por workspace.
```

Implicações:

- paginação;
- virtualização;
- server-side filtering;
- evitar renderizar tudo no DOM;
- queries granulares;
- performance mobile.

### 3.2 Mobile é requisito

A experiência mobile do Kanban/editor é requisito.

Regra:

```txt
Board e editor precisam funcionar em mobile.
```

Drag pode existir, mas em mobile deve haver fallback quando necessário.

### 3.3 WorkflowState é status real

Estados de workflow representam o status real do WorkItem.

Regra:

```txt
WorkflowState = status real do WorkItem.
```

### 3.4 BoardColumn é visão/agrupamento

Colunas do board representam uma visão ou agrupamento de estados.

Regra:

```txt
BoardColumn = visão/agrupamento de um ou mais WorkflowStates.
```

Uma coluna pode definir estado inicial, mas o card pode passar por outros estados dentro da mesma coluna.

Exemplo:

```txt
Coluna: Em negociação
Estados:
- proposta enviada
- aguardando retorno
- negociação ativa
```

### 3.5 Workflow states são globais por workspace

Estados de workflow devem ser globais por workspace.

Regra:

```txt
WorkflowStates pertencem ao workspace, não a uma perspectiva específica.
```

Motivo:

- uma perspectiva pode usar o mesmo estado de outra;
- evita duplicação;
- status do WorkItem fica consistente.

### 3.6 Board continua sendo fluxo visual principal

O fluxo visual principal dos WorkItems continua no Board.

Regra:

```txt
O fluxo visual operacional continua no Board.
```

Outros módulos, como Leads, podem oferecer overviews e ações específicas, mas não substituem o Board como fluxo visual principal.

---

## 4. List

### 4.1 List deve virar tabela operacional completa

O módulo List deve deixar de ser uma lista simples e virar uma tabela operacional completa de WorkItems.

Regra:

```txt
List = tabela operacional oficial de WorkItems.
```

Deve suportar:

- paginação server-side;
- busca;
- filtros;
- ordenação;
- seleção;
- ações em massa;
- colunas configuráveis;
- colunas por WorkItemType;
- status inline;
- mobile cards;
- integração com o formulário oficial de WorkItem.

### 4.2 Caminho mais performático deve ser priorizado

A implementação do List deve seguir o caminho mais performático.

Regra:

```txt
List deve usar estratégia performática para alto volume.
```

Isso implica:

- server-side pagination;
- server-side sorting;
- server-side filtering;
- virtualização quando necessário;
- TanStack Table/Virtual quando aplicável.

### 4.3 Configuração de List por WorkItemType

Deve ser possível configurar a visualização de lista por tipo de WorkItem.

Regra:

```txt
Cada WorkItemType pode ter sua própria configuração de List.
```

Exemplos de configuração:

- colunas visíveis;
- ordem das colunas;
- campos principais;
- status inline;
- layout mobile;
- filtros padrão;
- ordenação padrão;
- ações por linha;
- bulk actions.

### 4.4 List usa a infra oficial de WorkItem form

Criação e edição no List devem seguir a infra de `work-item-form`.

Regra:

```txt
List não deve criar form paralelo de WorkItem.
```

### 4.5 Padronizar tudo em uma única abordagem

O módulo List deve seguir a melhor opção arquitetural e padronizada do sistema.

Regra:

```txt
Não criar padrões próprios de tabela/form/modal/select no List.
```

---

## 5. Agenda

### 5.1 Agenda agenda WorkItems

A Agenda deve agendar WorkItems.

Regra:

```txt
Agenda define quando um WorkItem será executado.
```

A agenda não deve criar entidade operacional paralela se o WorkItem já contém o dado de agendamento.

### 5.2 Drag para reagendar

A Agenda deve suportar drag para reagendar.

Regra:

```txt
Arrastar item na Agenda altera a data/horário do WorkItem.
```

Ao arrastar:

- o dado alterado é o WorkItem;
- deve persistir no backend;
- deve ter rollback em erro;
- deve refletir no Board/List quando relevante.

### 5.3 WorkItem continua sendo o formulário oficial

Mesmo que a Agenda altere data/horário, o formulário oficial continua sendo o WorkItem.

Regra:

```txt
Agenda pode alterar campos de agendamento, mas não substitui o formulário do WorkItem.
```

### 5.4 Integrações externas futuras serão somente leitura

Google Calendar, Outlook ou Teams são integrações futuras e somente leitura inicialmente.

Regra:

```txt
Integrações externas de calendário começam como read-only.
```

### 5.5 Recorrência não é prioridade agora

Não há necessidade atual de recorrência avançada.

Regra:

```txt
Recorrência avançada não é requisito inicial da Agenda.
```

### 5.6 Tarefas fora da janela podem ser úteis

Itens fora da janela atual podem ser valiosos para o usuário.

Regra condicional:

```txt
Se agregar valor, Agenda deve mostrar itens fora da janela ou não agendados.
```

Isso ajuda a evitar que WorkItems importantes “sumam” da visão semanal.

---

## 6. Leads, Signals e Clientes

### 6.1 Lead oficial é WorkItem comercial

Regra central:

```txt
O Lead oficial do produto é o WorkItem comercial.
```

Não deve haver `Lead` separado como fonte oficial paralela.

### 6.2 Signal é WorkItem

Regra:

```txt
Signal também é WorkItem.
```

O fluxo comercial pode começar com um Signal.

### 6.3 Signal se transforma em Lead

Regra:

```txt
Signal deve poder se transformar em Lead.
```

Essa transformação é uma transformação de WorkItemType.

### 6.4 Signal sempre preserva dados ao virar Lead

Regra:

```txt
Signal → Lead nunca deve perder dados.
```

O tipo destino precisa conter os campos do tipo origem.

### 6.5 Lead pode virar Cliente

Quando o fluxo considera o Lead como cliente, deve ser possível cadastrá-lo como Customer.

Regra:

```txt
Lead finalizado pode ser convertido/vinculado a Customer.
```

### 6.6 Cliente é base cadastral separada

Cliente não é WorkItem.

Regra:

```txt
Customer é entidade cadastral separada.
```

A base de clientes deve servir para:

- selecionar clientes em leads futuros;
- preencher informações automaticamente;
- histórico comercial;
- cobranças;
- contratos;
- documentos;
- propostas.

### 6.7 Leads podem entrar em massa e quase em tempo real

Leads podem ser cadastrados manualmente ou brotar no Board em massa.

Fontes possíveis:

- site;
- Instagram;
- WhatsApp;
- formulários;
- webhooks;
- integrações;
- automações.

Regra:

```txt
O sistema deve suportar ingestão em massa/quase tempo real de Leads/Signals.
```

### 6.8 Paginação server-side é urgente

Regra:

```txt
Leads precisam de paginação server-side o quanto antes.
```

Não se deve depender de carregar todos os leads no cliente.

### 6.9 Marketing pode segmentar Leads

Marketing deve poder segmentar os leads oficiais, ou seja, WorkItems comerciais.

Regra condicional:

```txt
Marketing deve segmentar WorkItems comerciais se isso agregar valor.
```

### 6.10 Lead module não substitui Board

O módulo Leads deve oferecer:

- overview;
- ações comerciais;
- visão de clientes;
- conversão para customer;
- cobrança;
- filtros comerciais;
- ações específicas.

Mas:

```txt
Fluxo visual principal continua no Board.
```

### 6.11 Lead Flow deve permitir edição de etapas/status

O Lead Flow não deve ser apenas readonly.

Regra:

```txt
Lead Flow deve permitir edição de etapas/status.
```

Essa edição deve alterar o WorkItem/WorkflowState real, não apenas estado local.

---

## 7. Campos comerciais e templates

### 7.1 Campos comerciais devem ser versionados por templates

Regra:

```txt
Campos comerciais devem ser versionados através de templates.
```

Deve haver um template inicial.

Exemplos:

- CommercialSignalTemplate;
- CommercialLeadTemplate;
- CommercialCustomerTemplate;
- CommercialOpportunityTemplate.

### 7.2 Evitar slugs comerciais soltos

Campos como:

```txt
customerId
estimatedValue
proposalId
billingOrderId
```

não devem ficar espalhados como strings soltas.

Regra:

```txt
Campos comerciais devem ser centralizados em registry/template versionado.
```

---

## 8. Billing e cobranças

### 8.1 Existem dois tipos de cobrança

Regra:

```txt
Separar cobrança da plataforma Dask de cobrança Connect dos clientes do Dask.
```

### 8.2 Platform Billing

Platform Billing é quando o cliente paga o Dask.

```txt
Platform Billing = cliente paga o Dask.
```

Envolve:

- assinatura da plataforma;
- planos;
- invoices do Dask;
- portal da assinatura do Dask.

### 8.3 Workspace Connect Billing

Workspace Connect Billing é quando o cliente do Dask cobra o cliente dele.

```txt
Workspace Connect Billing = cliente do Dask cobra cliente dele via Dask.
```

Deve usar Stripe Connect.

### 8.4 Cobrança Connect usa Stripe Connect

Regra:

```txt
Cobrança Connect deve usar Stripe Connect.
```

O cliente do Dask cobra seu próprio cliente pelo Dask.

### 8.5 Cobrança sem Lead vinculado é permitida

Regra:

```txt
Cobrança sem Lead vinculado é permitida.
```

### 8.6 Cobrança vinculada a Lead sem contrato/proposta exige justificativa

Regra:

```txt
Cobrança vinculada a Lead sem contrato/proposta exige justificativa formal.
```

### 8.7 Cobrança vinculada a Lead com contrato/proposta é permitida

Regra:

```txt
Cobrança vinculada a Lead com contrato/proposta é permitida.
```

### 8.8 Cliente sem dados fiscais não pode pagar

Regra:

```txt
Cliente final não deve pagar sem dados fiscais completos.
```

Deve-se completar dados fiscais antes do pagamento.

### 8.9 Portal de cobrança precisa ser seguro

Se deixar portal/token sem expiração/revogação for vulnerabilidade, deve haver segurança.

Regra recomendada:

```txt
Portal token deve ter expiração, revogação, escopo e assinatura/hash seguro.
```

### 8.10 Stripe Connect precisa de validação de ambiente

Cobranças Connect só devem operar quando:

- conta Connect existe;
- onboarding completo;
- capabilities adequadas;
- charges/payouts habilitados;
- workspace apto a cobrar.

---

## 9. Fiscal

### 9.1 Focus NFe é o provider fiscal inicial

Regra:

```txt
Focus NFe será o provider fiscal inicial.
```

Ele deve ser usado para:

- NFe;
- NFSe;
- detectar/trazer notas vinculadas ao CNPJ do cliente.

### 9.2 Manter interface de provider fiscal

Mesmo com Focus como único provider inicial, deve existir abstração.

Regra:

```txt
Manter FiscalProvider para não acoplar todo o domínio à Focus.
```

### 9.3 Volume esperado inicial

Volume inicial estimado:

```txt
150 a 300 notas por mês no primeiro ano.
```

Mesmo com esse volume, paginação server-side deve existir em telas fiscais importantes.

### 9.4 Emissão fiscal pode ser automática ou manual

Regra:

```txt
Emissão fiscal após pagamento depende da configuração do usuário/workspace.
```

Deve suportar:

- criação de draft para revisão manual;
- emissão automática após pagamento.

### 9.5 Default seguro é revisão manual

Regra recomendada:

```txt
Default fiscal seguro = manual_review.
```

Automático só deve ocorrer quando tudo estiver configurado corretamente.

### 9.6 Assinaturas podem ter regras fiscais diferentes

Para assinatura cancelável a qualquer momento:

```txt
Tende a gerar nota recorrente por invoice/período.
```

Para contrato de meses:

```txt
Pode haver nota no checkout inicial com valor total do contrato, mesmo pago mês a mês, se isso for legal perante a lei brasileira.
```

Regra importante:

```txt
Não hardcodar regra fiscal sensível sem validação contábil/jurídica.
```

### 9.7 Apenas owner configura fiscal

Regra:

```txt
Somente owner do workspace pode configurar fiscal.
```

### 9.8 Usuário operacional pode emitir/ler conforme permissão

Configuração fiscal é owner-only, mas leitura/emissão pode depender de permissões específicas.

### 9.9 Dados fiscais completos são obrigatórios antes de pagar/emitir

Regra:

```txt
Não emitir nota nem permitir checkout sem dados fiscais obrigatórios.
```

---

## 10. Marketing

### 10.1 Jornadas devem executar de verdade

Regra:

```txt
Jornadas de marketing devem executar de verdade.
```

Elas não devem ser apenas desenho/configuração visual.

### 10.2 Marketing Journey usa Automation Runtime

Regra:

```txt
Marketing Journey deve compilar para Automation Runtime.
```

Não deve existir runtime separado de Marketing se Automations é o centro.

### 10.3 Editor visual de e-mail com preview HTML é ideal

Regra:

```txt
Marketing deve evoluir para editor visual/estruturado de e-mail com preview HTML.
```

Não precisa ser editor pesado inicialmente, mas o preview HTML é desejável.

### 10.4 Templates precisam ter ações reais

Templates devem suportar:

- criar;
- editar;
- duplicar;
- arquivar;
- visualizar;
- enviar teste.

Regra:

```txt
Não deixar ações de template como botões simulados.
```

### 10.5 Follow-up deve ser real se for valioso

Regra:

```txt
Criar follow-up no inbox de sinais deve criar entidade real se agregar valor.
```

Preferencialmente:

- WorkItem;
- LeadActivity;
- ou ambos, dependendo da arquitetura.

### 10.6 Analytics avançado não é foco da tela de Marketing

Regra:

```txt
Analytics avançado deve ficar no dashboard, não na tela principal de Marketing.
```

Marketing pode ter KPIs simples e resumo operacional.

### 10.7 Segmentação é positiva se agregar valor

Regra:

```txt
Marketing deve segmentar se isso agregar valor ao usuário.
```

A segmentação deve usar fonte oficial de dados, especialmente WorkItems comerciais para leads/sinais.

---

## 11. Automations

### 11.1 Automations é o centro de tudo

Regra central:

```txt
Automations é o runtime central do produto.
```

Isso significa:

- executa workflows;
- concentra runtime;
- concentra logs/runs/debug;
- pode executar jornadas de marketing;
- pode executar pipelines de AI Agents;
- pode responder a eventos de WorkItems;
- pode criar/alterar WorkItems;
- pode disparar e-mails;
- pode lidar com aprovações.

### 11.2 Não criar runtime paralelo

Regra:

```txt
Não criar runtime separado de AI ou Marketing se Automation Runtime resolve.
```

### 11.3 UI especializada pode existir

Mesmo com runtime central, cada área pode manter UI própria:

- AI Agents tem UI própria;
- Marketing Journey tem UI própria;
- Automations tem studio universal;
- Lead Flow tem UI comercial própria.

Regra:

```txt
Runtime pode ser central sem forçar todas as UIs a serem iguais.
```

### 11.4 Workflow inválido não pode publicar/executar

Regra:

```txt
Workflow inválido não pode ser publicado, ativado ou executado.
```

Deve validar:

- trigger;
- nodes obrigatórios;
- edges;
- condições;
- templates;
- tools;
- models;
- secrets;
- permissões;
- campos obrigatórios.

### 11.5 Node config deve usar descriptor

Regra:

```txt
Configuração de nodes deve usar NodeConfigDescriptor/NodeConfigForm.
```

JSON textarea pode existir apenas como modo avançado/debug, não como caminho principal.

### 11.6 Workflows grandes precisam clareza visual

Regra:

```txt
Workflows grandes devem ter minimap, validação visual, auto-layout opcional e debug step-by-step quando possível.
```

---

## 12. AI Agents

### 12.1 AI Agents é o lugar de criação dos agentes

Regra:

```txt
AI Agents continua sendo o lugar de criação de agentes.
```

A UI própria deve ser preservada.

### 12.2 AI Agent define pipeline RAG visual

Regra:

```txt
AI Agents deve permitir construir agente e definir pipeline RAG visualmente.
```

O pipeline pode ser resumido visualmente.

### 12.3 AI Agent pode virar tipo especial de Automation

Regra:

```txt
AI Agent pode compilar/adaptar para Automation Runtime, desde que a UI de AI Agents seja preservada.
```

### 12.4 Pipeline pode executar sequencial ou paralelo

Regra:

```txt
Pipeline de AI pode executar ações sequenciais ou paralelas.
```

### 12.5 Debug e clareza são importantes

Regra:

```txt
AI Agents devem ter execução/debug claros para o usuário.
```

Isso inclui:

- validação;
- publicação;
- execução;
- logs;
- steps;
- rastreabilidade;
- masking de dados sensíveis.

---

## 13. Flow Studio

### 13.1 FlowCanvas deve ser reaproveitado

Regra:

```txt
Não criar canvas paralelo quando FlowCanvas/FlowStudio resolve.
```

Isso vale para:

- Automations;
- AI Agents;
- Marketing Journey;
- Lead Flow.

### 13.2 NodeConfigForm é padrão

Regra:

```txt
NodeConfigForm/NodeConfigDescriptor deve ser padrão para configuração de nodes.
```

### 13.3 Não usar libs pesadas de forms dinâmicos agora

Regra:

```txt
Não priorizar SurveyJS, Form.io, JSONForms ou RJSF agora.
```

Preferir descriptor interno com RHF/Zod.

---

## 14. Documentation

### 14.1 Documentos são Markdown puro

Regra:

```txt
Documentation usa Markdown puro.
```

Não implementar rich text pesado agora.

### 14.2 Chat IA é volátil por sessão

Regra:

```txt
Histórico do chat IA em Documentation não precisa persistir agora.
```

Ao recarregar, pode sumir.

### 14.3 Cliente pode organizar pastas

Regra:

```txt
Cliente pode organizar pastas, respeitando permissões.
```

O cliente não pode acessar/organizar pastas internas fora de seu escopo.

### 14.4 Propostas/contratos usam Markdown e variáveis

Regra:

```txt
Propostas e contratos são Markdown com suporte a variáveis {{}}.
```

Não precisam inicialmente de campos estruturados além de Markdown.

### 14.5 Variáveis puxam dados do WorkItem vinculado

Regra:

```txt
Documentos podem usar variáveis {{}} para puxar dados do card/WorkItem vinculado.
```

Exemplos:

```txt
{{workItem.title}}
{{workItem.status}}
{{fields.estimatedValue}}
{{customer.name}}
```

### 14.6 Documento deve mostrar WorkItem vinculado

Regra:

```txt
Documento deve mostrar claramente a qual card/WorkItem está vinculado.
```

### 14.7 Assets precisam persistir em storage real

Regra:

```txt
Logo/anexos/assets não podem ficar apenas em base64/metadata.
```

Eles precisam persistir e não podem sumir com F5.

### 14.8 Busca, tags, paginação e permissões são desejáveis

Regra:

```txt
Documentation deve suportar busca, tags, paginação e permissões por documento/pasta.
```

### 14.9 Aceite pode ocorrer internamente e na página pública

Regra:

```txt
Aceite/recusa de documento pode ocorrer tanto internamente quanto na página pública.
```

### 14.10 Página pública exige login

Regra:

```txt
Na página pública, cliente só pode visualizar/aceitar documento após login/autenticação.
```

---

## 15. Permissões

### 15.1 Backend é autoridade final

Regra:

```txt
Permissões devem ser validadas no backend.
```

Frontend pode esconder/desabilitar ações, mas não é suficiente.

### 15.2 Owner configura fiscal

Regra confirmada:

```txt
Apenas owner do workspace pode configurar fiscal.
```

### 15.3 Reagendamento exige permissão de editar WorkItem

Regra:

```txt
Usuário sem permissão de atualizar WorkItem não pode reagendar na Agenda.
```

### 15.4 Publish/run/activate precisam de permissão

Ações críticas devem validar permissão:

- publicar workflow;
- executar workflow;
- ativar jornada;
- publicar agente;
- executar agente;
- emitir fiscal;
- criar cobrança;
- alterar estado de lead;
- transformar WorkItemType.

---

## 16. Segurança

### 16.1 Não vazar dados entre workspaces

Regra:

```txt
Nenhum dado pode ser acessado fora do workspace correto.
```

### 16.2 Página pública precisa respeitar autorização

Regra:

```txt
Página pública de documento/proposta/contrato deve exigir autenticação quando definido.
```

### 16.3 Markdown não pode executar HTML perigoso

Regra:

```txt
Markdown deve ser renderizado de forma segura.
```

Variáveis devem ser resolvidas sem execução arbitrária.

### 16.4 Variáveis `{{}}` não podem acessar qualquer path

Regra:

```txt
Variáveis devem vir de registry permitido.
```

Não permitir acesso arbitrário a dados sensíveis.

### 16.5 Logs/debug devem mascarar secrets

Regra:

```txt
Runs/logs/debug não devem vazar secrets, tokens, API keys ou dados sensíveis.
```

### 16.6 Uploads precisam validação

Regra:

```txt
Uploads devem validar tipo, tamanho, workspace e permissão.
```

---

## 17. Auditoria e histórico

### 17.1 Board/config

Auditar:

- criação/edição/remoção de campos;
- alteração de layouts;
- alteração de estados;
- alteração de perspectivas;
- alteração de colunas;
- publicação de schema.

### 17.2 WorkItems/Leads

Auditar:

- criação;
- alteração de status;
- transformação Signal → Lead;
- conversão Lead → Customer;
- vincular/desvincular Customer;
- bulk actions;
- alteração via automação.

### 17.3 Billing/Fiscal

Auditar:

- criação de cobrança;
- cobrança com justificativa;
- checkout;
- portal token;
- empresa fiscal;
- policy fiscal;
- emissão/retry/cancelamento de nota;
- sync Focus;
- webhooks críticos.

### 17.4 Documentation

Auditar:

- envio comercial;
- aceite;
- recusa;
- alteração depois do aceite;
- upload de assets;
- alteração de permissões.

### 17.5 Automations/AI/Marketing

Auditar:

- workflow publicado;
- run iniciado/finalizado/falhou;
- jornada ativada/pausada;
- agente publicado/executado;
- aprovação/rejeição.

---

## 18. Integrações e smoke

### 18.1 Smoke autenticado deve ser repetível

Regra técnica/produto:

```txt
Fluxos críticos precisam de smoke autenticado repetível.
```

Prioridades:

- Billing;
- Fiscal;
- AI Agents;
- Automations;
- Marketing Journey.

### 18.2 Classificar gaps corretamente

Gaps devem ser classificados como:

- environment gap;
- backend gap;
- frontend bug;
- contract mismatch.

### 18.3 Stripe/Focus/AI dependem de ambiente

Testes reais de:

- Stripe Connect;
- Focus homologação;
- AI provider;

dependem de ambiente válido e devem ser documentados.

---

## 19. Design system e padronização

### 19.1 Usar uma única abordagem de UI

Regra:

```txt
Padronizar tudo em shared/ui e wrappers internos.
```

Componentes esperados:

- AppDialog;
- AppSelect;
- AppPopover;
- AppDropdownMenu;
- AppTooltip;
- AppTabs;
- AppDatePicker;
- AppDateTimePicker;
- Sonner/toast;
- EmptyState;
- LoadingState;
- ErrorState;
- ResourceTable/DataTable;
- FlowCanvas/FlowStudio;
- NodeConfigForm.

### 19.2 Não criar wrappers por módulo sem necessidade

Regra:

```txt
Não criar MarketingDialog, LeadDialog, BillingSelect etc. se shared/ui resolve.
```

### 19.3 Não migrar visual inteiro de uma vez

Regra:

```txt
Não fazer migração visual radical sem necessidade.
```

Manter CSS/tokens atuais e evoluir gradualmente.

---

## 20. Bibliotecas: regras de uso

### 20.1 Usar libs maduras para infraestrutura

Devem ser usadas libs maduras para:

- forms;
- validação;
- cache;
- tabelas;
- virtualização;
- DnD;
- flow canvas;
- date picker;
- toasts;
- UI acessível.

### 20.2 Stack aprovada

Stack aprovada ao longo da conversa:

```txt
React Query
React Hook Form
Zod
@hookform/resolvers
Radix wrappers/shared UI
Sonner
TanStack Table
TanStack Virtual
dnd-kit
XYFlow / React Flow
React DayPicker
react-markdown
remark-gfm
Lucide/AppIcon
```

### 20.3 Evitar libs gigantes de form builder agora

Não priorizar:

```txt
SurveyJS
Form.io
JSONForms
RJSF
```

Motivo:

- domínio próprio forte;
- WorkItem schema próprio;
- builders específicos;
- risco de engessar UX.

### 20.4 Charts pesados não são prioridade

Regra:

```txt
Charts CSS atuais bastam por enquanto.
```

Não priorizar:

- Recharts;
- Nivo;
- ECharts;

salvo quando dashboards realmente exigirem.

### 20.5 Editor rich text pesado não é prioridade

Não priorizar:

- TipTap;
- Lexical;
- MDXEditor;

especialmente porque Documentation foi definido como Markdown puro.

---

## 21. Pontos condicionais / ainda dependentes de decisão

### 21.1 Tailwind/shadcn

Decisão:

```txt
Usar o que for mais viável arquiteturalmente.
```

Não migrar tudo de uma vez.

### 21.2 Assinatura com contrato e nota fiscal

Ainda depende de validação contábil/jurídica:

```txt
Contrato de meses pode gerar nota total no checkout inicial apenas se isso for legal perante a lei brasileira.
```

### 21.3 Segmentação avançada

Segmentação é positiva se agregar valor, mas escopo deve ser controlado.

### 21.4 Autosave em List

Validação em tempo real/draft são desejáveis, mas autosave deve ser implementado com cuidado.

### 21.5 Métricas no List

Métricas no List não devem virar dashboard pesado. Depende de valor UX.

### 21.6 Máscaras

Máscaras para CPF/CNPJ/telefone/moeda são úteis, mas podem ser adicionadas quando Billing/Fiscal/Leads exigirem.

### 21.7 Integrações externas de calendário

Google/Outlook/Teams são futuras e somente leitura inicialmente.

---

## 22. Resumo das regras mais críticas

1. **WorkItem é o núcleo operacional do produto.**
2. **Lead oficial é WorkItem comercial.**
3. **Signal é WorkItem e pode se transformar em Lead sem perder dados.**
4. **Cliente é entidade cadastral separada.**
5. **WorkflowState é status real; BoardColumn é visão.**
6. **Estados de workflow são globais por workspace.**
7. **List deve ser tabela operacional completa por WorkItemType.**
8. **Agenda agenda WorkItems e drag altera o WorkItem.**
9. **Marketing Journey deve executar de verdade via Automation Runtime.**
10. **Automations é o runtime central do produto.**
11. **AI Agents mantém UI própria, mas pode compilar/adaptar para Automation Runtime.**
12. **Billing deve separar Platform Billing de Workspace Connect Billing.**
13. **Connect Billing usa Stripe Connect.**
14. **Cliente sem dados fiscais completos não paga.**
15. **Focus NFe é o provider fiscal inicial.**
16. **Somente owner configura fiscal.**
17. **Fiscal automático depende de policy válida; default seguro é manual review.**
18. **Documentation é Markdown puro com variáveis `{{}}` via WorkItem vinculado.**
19. **Aceite público de documento exige login/autenticação.**
20. **Mudanças sensíveis precisam de auditoria.**
21. **Não criar runtimes, forms, modais, selects ou canvases paralelos quando há padrão compartilhado.**
22. **Não adicionar libs gigantes sem necessidade; aplicar corretamente as libs já aprovadas.**

---

## 23. Próxima utilização recomendada desta documentação

Esta documentação deve ser usada como:

- referência de produto;
- base para prompts do Codex;
- checklist de auditoria;
- guia para QA;
- base de modelagem de entidades;
- base para documentação técnica;
- fonte para futuras decisões de arquitetura.

Sempre que uma feature nova for planejada, validar:

```txt
Ela respeita WorkItem como fonte oficial?
Ela evita domínio paralelo?
Ela usa schema/versionamento quando altera estrutura?
Ela tem permissão/auditoria quando sensível?
Ela usa shared UI/padrões existentes?
Ela evita libs pesadas desnecessárias?
```
