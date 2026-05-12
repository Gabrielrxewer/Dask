# Frontend Health Report

Snapshot gerado em 2026-05-02 para `dask-app/src`.

Escopo: arquitetura de frontend, tamanho de arquivos, responsabilidade por pagina, uso de `shared/ui`, duplicacoes restantes e plano de refactor. Este relatorio nao altera codigo funcional.

## Como as metricas foram coletadas

- Contagem de linhas: `Get-ChildItem src -Recurse -File -Include *.tsx,*.ts,*.css` + `Measure-Object -Line`.
- Ranking por pagina: agrupamento por pasta direta em `src/pages`.
- Componentes de `shared/ui`: contagem de linhas por subpasta, excluindo testes.
- Observacao qualitativa: leitura dos maiores arquivos, dos imports de `@/shared/ui` e dos padroes locais de loading/empty/skeleton.

## Maiores arquivos TSX

| Linhas | Arquivo |
| ---: | --- |
| 1696 | `src/entities/task/ui/field-presentation/field-type-specs.tsx` |
| 1006 | `src/app/layout/global-layout.tsx` |
| 789 | `src/widgets/task-details/ui/task-details-modal.tsx` |
| 769 | `src/pages/settings-page/ui/general-settings.tsx` |
| 769 | `src/modules/workspace/providers/workspace-provider.tsx` |
| 756 | `src/pages/settings-page/ui/work-item-editor-settings.tsx` |
| 754 | `src/pages/automations-page/ui/automations-page.tsx` |
| 712 | `src/pages/automations-page/ui/automations-page.local.tsx` |
| 689 | `src/pages/agenda-page/ui/agenda-page.tsx` |
| 681 | `src/pages/fiscal-page/ui/fiscal-page.tsx` |
| 669 | `src/pages/documentation-page/ui/documentation-page.tsx` |
| 625 | `src/pages/settings-page/ui/board-editor-settings.tsx` |
| 624 | `src/pages/settings-page/ui/workflow-states-settings.tsx` |
| 613 | `src/features/auth/ui/login-form.tsx` |
| 556 | `src/pages/settings-page/ui/work-item-editor-properties.tsx` |

## Maiores arquivos TS

| Linhas | Arquivo |
| ---: | --- |
| 1064 | `src/modules/workspace/api/workspace-service.ts` |
| 987 | `src/modules/workspace/model/types.ts` |
| 760 | `src/pages/billing-page/ui/use-billing-page-model.ts` |
| 730 | `src/pages/marketing-page/ui/use-marketing-page-model.ts` |
| 448 | `src/features/auth/model/auth-store.ts` |
| 353 | `src/entities/task/model/field-bindings.ts` |
| 340 | `src/modules/marketing/api/marketing-service.ts` |
| 316 | `src/modules/fiscal/model/types.ts` |
| 284 | `src/pages/settings-page/ui/use-work-item-editor-layout.ts` |
| 275 | `src/pages/settings-page/ui/work-item-editor-field-model.ts` |
| 269 | `src/pages/commercial-page/ui/commercial-page.model.ts` |
| 263 | `src/pages/marketing-page/ui/marketing-page.model.ts` |
| 239 | `src/entities/task/model/task-card-render-model.ts` |
| 238 | `src/pages/settings-page/ui/work-item-editor-preview-model.ts` |
| 232 | `src/pages/settings-page/model/work-item-layout-editor.ts` |

## Maiores arquivos CSS

| Linhas | Arquivo |
| ---: | --- |
| 3547 | `src/pages/billing-page/ui/billing-page.css` |
| 2771 | `src/pages/marketing-page/ui/marketing-page.css` |
| 2684 | `src/pages/home-page/ui/home-page.css` |
| 2627 | `src/app/layout/global-layout.css` |
| 2622 | `src/entities/task/ui/field-presentation/field-presentation.css` |
| 2153 | `src/widgets/task-details/ui/task-details-modal.css` |
| 2055 | `src/pages/settings-page/ui/work-item-editor-settings.css` |
| 1767 | `src/pages/documentation-page/ui/documentation-page.css` |
| 1418 | `src/pages/commercial-page/ui/commercial-page.css` |
| 1257 | `src/pages/agenda-page/ui/agenda-page.css` |
| 1164 | `src/pages/settings-page/ui/members-settings.css` |
| 1136 | `src/pages/settings-page/ui/board-editor-settings.css` |
| 1038 | `src/pages/settings-page/ui/general-settings.css` |
| 954 | `src/pages/workspace-selector-page/ui/workspace-selector-page.css` |
| 811 | `src/entities/task/ui/task-card.css` |

## Paginas com mais responsabilidade

| Pagina | Linhas totais | Arquivos | TS/TSX | CSS | Maior arquivo |
| --- | ---: | ---: | ---: | ---: | --- |
| `settings-page` | 15355 | 61 | 9034 | 6321 | `ui/work-item-editor-settings.css` |
| `marketing-page` | 7562 | 27 | 3912 | 3650 | `ui/marketing-page.css` |
| `billing-page` | 5930 | 15 | 2383 | 3547 | `ui/billing-page.css` |
| `documentation-page` | 3301 | 10 | 1534 | 1767 | `ui/documentation-page.css` |
| `home-page` | 3206 | 5 | 522 | 2684 | `ui/home-page.css` |
| `commercial-page` | 3080 | 13 | 1662 | 1418 | `ui/commercial-page.css` |
| `agenda-page` | 2292 | 8 | 1035 | 1257 | `ui/agenda-page.css` |
| `automations-page` | 2265 | 4 | 1467 | 798 | `ui/automations-page.css` |
| `ai-agents-page` | 2119 | 8 | 1375 | 744 | `ui/ai-agents-page.tsx` |
| `workspace-selector-page` | 1351 | 3 | 397 | 954 | `ui/workspace-selector-page.css` |

### Leitura dos hotspots

- `settings-page` e a principal concentracao de responsabilidade. Ela mistura varios editores completos: board, estados, work items, membros, grupos, permissoes e settings gerais.
- `marketing-page` tem boa divisao por tabs, mas o CSS e o model hook ainda concentram muita regra visual e estado de produto.
- `billing-page` ja foi quebrada em paineis e model hook, mas o CSS e o loader local ainda indicam muito comportamento visual especifico na page.
- `field-type-specs.tsx` e `field-presentation.css` sao os maiores arquivos fora de pages. Eles formam um mini framework de campos e merecem governanca propria.
- `global-layout.tsx/css` estao grandes para layout global; parte do perfil, billing status e chrome pode virar subcomponentes internos.

## `shared/ui`: componentes e principais usos

`shared/ui/index.ts` atualmente exporta componentes e tipos publicos para a maior parte dos primitives. A superficie publica esta ampla o bastante para evitar imports profundos na maioria das pages.

| Componente | Papel | Principais usos observados |
| --- | --- | --- |
| `Button` | Botao base de formularios, modais e acoes | Auth, billing, commercial, settings, workspace selector, filters |
| `TextInput`, `Select`, `Textarea`, `FormField` | Formularios compactos | Billing, commercial, marketing, settings, workspace selector, task field presentation |
| `ModalShell`, `FormModal`, `DrawerShell` | Modais/drawers padronizados | Create task, billing, documentation, commercial, settings access drawers |
| `LoadingState` | Loading tematico inline/frame | App routes, agenda, AI agents, automations, board, documentation, fiscal, commercial, list, marketing, settings |
| `EmptyState` | Mensagem vazia simples | Agenda, billing catalog, fiscal fallback, list |
| `SkeletonBlock`, `SkeletonLayout`, `SkeletonColumns` | Skeleton estrutural | Board/settings loaders, work item editor |
| `ResourceSection`, `ResourceTable`, `DataTable` | Secoes/tabelas de dados | Commercial, fiscal, list, members |
| `Tabs`, `WorkspaceTopNavigation` | Navegacao segmentada | Billing, board perspectives, marketing, settings |
| `MetricCard`, `StatusBadge` | KPIs e status | App shell metrics, platform admin, billing, fiscal, marketing, members |
| `WorkspaceFrame`, `WorkspaceActionButton`, `PageHeader` | Chrome de paginas internas | Workspace pages, documentation, dashboard filter, app shell |
| `FlowCanvas`, `FlowNodeCard` | Editor visual de fluxos | Automations, AI agents, marketing journey builder |
| `AppIcon` | Iconografia tipada | Acoes e tabs em praticamente todas as areas novas |

### Tamanho dos componentes `shared/ui`

| Componente | Linhas sem testes | Observacao |
| --- | ---: | --- |
| `flow-canvas` | 942 | Alto, mas e um primitive especializado e reutilizado por 3 dominios |
| `global-loading` | 346 | Nao esta no barrel publico; e provider de app |
| `select` | 189 | Custom select com comportamento proprio; manter testado |
| `icon` | 185 | Catalogo tipado; cresce com biblioteca de icones |
| `metric-card` | 178 | Primitive maduro com testes |
| `loading-state` | 144 | Loader tematico; bom candidato a substituir loaders locais equivalentes |
| `resource-table` | 129 | Boa abstracao para tabelas declarativas |
| `tabs` | 121 | Ja cobre badges, locked/disabled e top navigation |
| `skeleton` | 120 | Primitive essencial para loading estrutural |
| `user-avatar` | 116 | Mistura display e modo editavel; observar crescimento |
| `workspace-action-button` | 113 | Nome ainda produto-especifico, mas uso e claramente de chrome workspace |
| `form-modal` | 105 | Ajuda a reduzir modais locais repetidos |

## Principais duplicacoes restantes

1. Estados de loading/empty locais equivalentes
   - `billing-loader.tsx` duplica um loader de billing que ja existe em `LoadingState animation="billing"`.
   - `platform-admin-page.tsx` define `EmptyState` local simples.
   - `members-list-section.tsx`, `workspace-invites-section.tsx`, `general-settings.tsx` e `workflow-states-settings.tsx` ainda usam `<p>` locais para loading/empty simples.

2. Estados ricos locais que devem ser preservados por enquanto
   - Canvas vazio de automations/marketing journey builder.
   - Estados de inbox de marketing (`mkt-state`) com copy, CTA e erro contextual.
   - Estados de disponibilidade da agenda.
   - Empty state de assistente/documentacao com avatar e narrativa.

3. CSS de page muito grande
   - `billing-page.css`, `marketing-page.css`, `home-page.css`, `global-layout.css` e `field-presentation.css` concentram muitos tokens, estados, dark theme e variantes.
   - O risco maior nao e apenas tamanho; e acoplamento de comportamento visual a nomes de page, dificultando reuso.

4. Formularios e modais ainda parcialmente locais
   - `FormModal`, `DrawerShell`, `FormField`, `Button`, `TextInput`, `Select` ja existem, mas algumas pages mantem estruturas manuais de modal/form footer.
   - Refactor deve ser gradual: migrar somente quando o modal local nao tiver comportamento visual especifico.

5. Tabelas e listas
   - `ResourceTable` cobre bem dados tabulares, mas algumas listas ainda reimplementam empty/loading e actions.
   - `DataTable` e usado para layouts mais controlados; manter diferenca clara entre declarativo (`ResourceTable`) e composicional (`DataTable`).

6. Hooks de page model grandes
   - `use-billing-page-model.ts` e `use-marketing-page-model.ts` concentram regra de orquestracao, transformacao e feedback.
   - Sao bons pontos para extrair selectors/helpers puros com teste, sem mexer nos componentes.

## Plano de refactor por prioridade

### P0: Guardrails e regressao

- Manter `npm run typecheck` e `npm test -- --run` como verificacao minima antes de merges grandes de UI.
- Para qualquer novo primitive em `shared/ui`, exigir:
  - export no `shared/ui/<component>/index.ts`;
  - export no barrel `shared/ui/index.ts` se for API publica;
  - teste minimo de render/props;
  - props nativas quando fizer sentido (`HTMLAttributes`, `ButtonHTMLAttributes`, etc.).
- Evitar adicionar novo CSS global de page quando um primitive existente ja cobre o caso.

### P1: Reduzir duplicacoes seguras

- Substituir loaders equivalentes por `LoadingState` quando forem full-page/frame ou inline simples.
- Substituir empty simples por `EmptyState` ou `ResourceSection empty`.
- Substituir skeletons manuais por `SkeletonBlock`/`SkeletonLayout`.
- Migrar modais simples para `FormModal` e drawers simples para `DrawerShell`.

### P2: Quebrar hotspots por fronteira de responsabilidade

- `settings-page`: separar cada editor em pacote interno com `model`, `ui` e CSS menor por contexto.
- `marketing-page`: extrair estados de inbox/campaign analytics para primitives de marketing page, depois avaliar o que sobe para `shared/ui`.
- `billing-page`: dividir CSS por painel (`account`, `catalog`, `charge`, `history`) ou migrar padroes repetidos para classes shared.
- `field-presentation`: criar subpastas por tipo de campo ou familia de campo, mantendo um registry central pequeno.

### P3: Consolidar design system

- Promover padroes recorrentes de empty panel, feedback banner, toolbar e table actions para `shared/ui` quando aparecerem em 3+ dominios.
- Reduzir page CSS com tokens e classes compartilhadas.
- Documentar no `SHARED_UI_MAP.md` exemplos aprovados de loading, empty, skeleton, table, modal e drawer.

## Checklist para novas features

Antes de criar UI nova:

- [ ] Existe primitive em `shared/ui` que cobre o caso?
- [ ] Se a nova UI for estado vazio, use `EmptyState` ou `ResourceSection empty`, salvo estado tematico rico.
- [ ] Se for loading de pagina/frame, use `LoadingState`.
- [ ] Se for loading estrutural, use `SkeletonBlock`, `SkeletonLayout` ou `SkeletonColumns`.
- [ ] Se for tabela declarativa, comece por `ResourceTable`; se precisar layout custom, use `DataTable`.
- [ ] Se for modal/drawer comum, comece por `ModalShell`, `FormModal` ou `DrawerShell`.
- [ ] Evite criar CSS de page para padroes de botao, input, status, badge, tabs, cards, table, modal e empty state.
- [ ] Props publicas novas devem aceitar `className` e atributos nativos quando seguro.
- [ ] Nome de componente shared deve ser generico, nao nomeado pelo dominio do produto.
- [ ] Estado async visivel deve ter semantica acessivel (`role="status"`, `aria-live`, `aria-hidden` correto).
- [ ] Se criar primitive compartilhado, adicione teste minimo de render e exporte tipos.
- [ ] Se um arquivo TSX passar de 500 linhas, avaliar extrair subcomponentes/model helpers.
- [ ] Se um CSS passar de 800 linhas, avaliar dividir por subfeature ou promover tokens/classes compartilhadas.
- [ ] Evite misturar fetch/orquestracao, transformacao de dados e render complexo no mesmo componente.
- [ ] Para pages novas, manter `page.tsx` como composicao e mover estado complexo para hooks/modelos testaveis.

## Indicadores de saude sugeridos

- Nenhum arquivo de page TSX novo acima de 500 linhas sem justificativa.
- Nenhum CSS novo acima de 800 linhas sem plano de split.
- Todo componente em `shared/ui` com teste de render minimo.
- Todo export publico em `shared/ui/index.ts` revisado junto com o componente.
- Duplicacao de loading/empty/skeleton reduzida a estados realmente tematicos.
- Hooks de page model com helpers puros testados quando passam de 400 linhas.
