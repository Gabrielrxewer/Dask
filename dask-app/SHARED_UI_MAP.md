# Shared UI Map

Mapa rapido dos componentes publicados em `src/shared/ui`. Use este arquivo como guia antes de criar primitives locais em `src/pages`.

| Componente | Finalidade | Principais props | Exemplo | Pages migradas / usos principais |
| --- | --- | --- | --- | --- |
| `Button` | Botao base para acoes de formulario e tabela. | `variant`, `size`, props nativas de `button`. | `<Button variant="outline" size="sm">Editar</Button>` | Billing, Fiscal, Commercial, Marketing, Settings, Workspace selector. |
| `WorkspaceActionButton` | Botao iconico para top navigation de views do workspace. | `label`, `icon`, `tone`, props nativas de `button`. | `<WorkspaceActionButton label="Atualizar" icon={<AppIcon name="refresh" />} />` | Commercial, Marketing, Documentation, AI agents. |
| `TextInput` | Input textual com estilo compartilhado. | Props nativas de `input`. | `<TextInput value={search} onChange={onSearchChange} />` | Billing, Commercial, Marketing, Settings, Workspace selector. |
| `Select` | Select customizado com fallback nativo. | Props nativas de `select`, `children` com `option`. | `<Select value={status}><option value="active">Ativo</option></Select>` | Billing, Commercial, Marketing, Settings. |
| `Textarea` | Textarea compartilhado com suporte a `ref`. | Props nativas de `textarea`. | `<Textarea rows={3} value={notes} />` | Billing, Documentation, Commercial, Marketing, Settings. |
| `FormField` | Wrapper label + campo para formularios compactos. | `label`, `className`, `children`. | `<FormField label="Nome"><TextInput /></FormField>` | Billing, Commercial, Marketing, Settings, Workspace selector. |
| `ModalShell` | Shell acessivel para modais e drawers via portal. | `titleId`, `className`, `onClose`, `children`. | `<ModalShell titleId="delete-title" onClose={onClose}>...</ModalShell>` | Agenda, Billing, Documentation, Commercial, Settings, Workspace selector, Automations. |
| `Section` | Secao padronizada com titulo, subtitulo e actions. | `title`, `subtitle`, `actions`, `className`, `children`. | `<Section title="Membros" actions={...}>...</Section>` | Agenda, Billing, Settings. |
| `Card` | Card simples ou interativo. | `variant`, `className`, props de `article`. | `<Card variant="interactive">...</Card>` | No-workspace, Workspace selector. |
| `MetricCard` | Card de metrica com tooltip opcional. | `label`, `value`, `description`, `className`. | `<MetricCard label="MRR" value="R$ 12k" />` | Usos compartilhados em widgets/metrics; ainda ha KPIs locais em Commercial. |
| `Tabs` | Lista simples de tabs sem contadores. | `value`, `items`, `onChange`, `className`. | `<Tabs value={tab} items={items} onChange={setTab} />` | Commercial, Marketing, Fiscal, Members settings. |
| `WorkspaceTopNavigation` | Wrapper de tabs com actions a direita para navegacoes superiores do workspace. | `value`, `items`, `onChange`, `ariaLabel`, `actions`, `tabsClassName`, `actionsClassName`. | `<WorkspaceTopNavigation value={tab} items={items} actions={<Toolbar />} />` | Billing, Marketing, Agenda. |
| `StatusBadge` | Badge de status generico. | `tone`, `children`. Tons: `default`, `success`, `warning`, `danger`, `info`. | `<StatusBadge tone="success">Ativo</StatusBadge>` | Agenda, AI agents, Automations, Billing, Fiscal, Marketing, Settings. |
| `EmptyState` | Mensagem vazia simples. | `children`. | `<EmptyState>Nenhum item encontrado.</EmptyState>` | Agenda, Billing, Commercial. |
| `LoadingState` | Loader tematico inline ou overlay/frame. | `text`, `animation`, `variant`, `visible`, `className`. | `<LoadingState animation="billing" variant="frame" visible={loading} />` | Agenda, AI agents, Automations, Board, Documentation, Commercial, Marketing, Settings. |
| `PageHeader` | Header simples de pagina com label e actions. | `label`, `title`, `actions`. | `<PageHeader label="Fiscal" title="Notas" />` | Disponivel para novas migracoes; pouco usado nas pages atuais. |
| `FilterBar` | Container compartilhado para filtros. | Props de `div`, `children`. | `<FilterBar><FormField ... /></FilterBar>` | Disponivel; filtros locais ainda predominam em Commercial/Marketing/Documentation. |
| `DataTable` | Tabela responsiva por grid. | `columns`, `responsiveMinWidth`, `responsiveMinWidthMobile`, `children`. | `<DataTable columns="1fr 120px">...</DataTable>` | Billing, Commercial. |
| `ResourceTable` | Tabela declarativa baseada em colunas, rows e actions. | `data`, `columns`, `rowKey`, `actions`, `emptyState`, `loading`. | `<ResourceTable data={rows} columns={columns} rowKey="id" />` | Fiscal. |
| `UserAvatar` | Avatar com iniciais, imagem e modo editavel. | `alt`, `imageUrl`, `initials`, `size`, `editable`, upload/remove callbacks. | `<UserAvatar alt={name} initials="JD" size="sm" />` | Members settings. |
| `WorkspaceFrame` | Frame visual padrao para paginas internas do workspace. | `className`, `children`. | `<WorkspaceFrame className="billing-view">...</WorkspaceFrame>` | Agenda, AI agents, Automations, Billing, Board, Documentation, Commercial, Marketing, Settings. |
| `AppIcon` | Wrapper tipado para icones Lucide permitidos. | `name`, `size`, `strokeWidth`, props Lucide. | `<AppIcon name="trash" />` | Agenda, Billing, Board, Documentation, Marketing, Settings. |
| `FlowCanvas` | Canvas compartilhado baseado em React Flow. | `nodes`, `edges`, `nodeTypes`, `paletteItems`, callbacks de mudanca. | `<FlowCanvas nodes={nodes} edges={edges} paletteItems={items} />` | Automations, AI agents, Marketing journey builder. |
| `FlowNodeCard` | Card visual de node para fluxos. | `kind`, `typeLabel`, `label`, `icon`, `branches`, `selected`. | `<FlowNodeCard kind="trigger" typeLabel="Trigger" label="Novo sinal" />` | Automations, AI agents, Marketing journey builder. |

## Observacoes de consistencia

- `src/shared/ui/index.ts` e os `index.ts` de cada componente exportam agora os componentes e seus tipos de API publica.
- `StatusBadge` aceita todos os tons ja definidos no CSS compartilhado: `default`, `success`, `warning`, `danger` e `info`.
- Primitives locais ainda existentes parecem ter papel de dominio ou variacao visual especifica, nao sobras sem uso:
  - `commercial-page` primitives: `KpiCard`, `Badge`, `FormModal`, `CommercialModalHeader`.
  - `billing-status-tabs.tsx`: tab com contadores e estado locked, alem da top navigation.
  - drawers de Members settings: wrappers de `ModalShell` com navegacao interna especifica de permissao.

## Oportunidades restantes

- Avaliar um `FormModal` compartilhado se outros fluxos repetirem header + submit/cancel com `ModalShell`.
- Avaliar um `Tabs` com badges/counts para substituir variacoes em Billing, Board perspective e tabs de Settings.
- Avaliar um `DrawerShell` compartilhado para os drawers de permissao em Members settings.
- Avaliar um `Skeleton`/`LoadingSkeleton` simples para loaders estruturais de Board editor e Work item editor.
- Migrar filtros locais recorrentes para `FilterBar` quando houver tempo para ajustar CSS sem mudar layout.
