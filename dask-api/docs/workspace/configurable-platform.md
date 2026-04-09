# Workspace Configurable Platform (Backend)

## Objetivo

Evoluir o backend para um modelo configurável por workspace, removendo dependência de enums rígidos para tipo/status/coluna e fornecendo APIs para configuração e operação de work items.

## Mudanças de contrato

- **Novo endpoint principal para frontend**: `GET /workspaces/:workspaceId/snapshot`
  - Entrega `tasks`, `membersById`, `boardConfig`, `preferences` e `automations` (compatibilidade), além de estrutura canônica configurável (`itemTypes`, `workflowStates`, `boardColumns`, `customFieldDefinitions`, `workItems`, etc).
- **Novo endpoint de configuração consolidada**: `GET /workspaces/:workspaceId/config`
- **Novas APIs de manutenção de configuração** para item types, workflow states, board columns, tags, custom fields e preferences.
- **Novas APIs operacionais de work items** para create/update/move/transition/tags/custom field values.

## Compatibilidade

- O modelo físico `Item` foi mantido (compatibilidade), porém evoluído para suportar:
  - `typeId` (WorkItemType)
  - `stateId` (WorkflowState)
  - `boardColumnId` (BoardColumn)
  - `assigneeId`, `parentId`, `dueDate`, `position`, `checklist`, `updatedBy`
- Campos legados `type`, `status`, `columnId` permanecem e são sincronizados para suporte a contratos antigos e rollout gradual.
- O snapshot inclui adapter legado para consumo imediato pelo frontend atual.

## Seed e backfill

- Criação de workspace já executa bootstrap padrão (`default-workspace-seed.ts`):
  - tipos, estados, colunas, mapeamento coluna-estado, campos customizados e preferências padrão
  - board padrão inicial
- Backfill de itens legados é executado de forma idempotente durante bootstrap/uso:
  - mapeia `type/status` legados para `typeId/stateId/boardColumnId`
  - preserva dados antigos

## Rollout recomendado

1. Aplicar migration nova.
2. Subir backend com as novas rotas.
3. Consumir `GET /workspaces/:workspaceId/snapshot` no frontend no lugar do mock.
4. Migrar gradualmente telas de admin para consumir APIs de configuração.
5. Após estabilização, descontinuar gradualmente endpoints legados (`/items`, snapshot antigo de board).
