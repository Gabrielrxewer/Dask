export const DomainEventNames = {
  BoardCreated: 'board.created',
  TemplateCreated: 'template.created',
  ItemCreated: 'item.created',
  ItemUpdated: 'item.updated',
  ItemMoved: 'item.moved',
  ItemStateChanged: 'item.state.changed',
  ItemDescriptionImprovementRequested: 'item.description.improvement.requested',
  ItemEmbeddingRequested: 'item.embedding.requested',
  AutomationRuleCreated: 'automation.rule.created',
  AutomationRuleUpdated: 'automation.rule.updated'
} as const;
