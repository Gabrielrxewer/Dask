import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'exists'
  | 'not_exists'
  | 'is_true'
  | 'is_false';

type ConditionConfig = {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

const operatorAliases: Record<string, ConditionOperator> = {
  equals: 'equals',
  eq: 'equals',
  '==': 'equals',
  not_equals: 'not_equals',
  notEquals: 'not_equals',
  neq: 'not_equals',
  '!=': 'not_equals',
  exists: 'exists',
  present: 'exists',
  not_exists: 'not_exists',
  notExists: 'not_exists',
  missing: 'not_exists',
  is_true: 'is_true',
  true: 'is_true',
  boolean_true: 'is_true',
  is_false: 'is_false',
  false: 'is_false',
  boolean_false: 'is_false'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeConditionConfig(config: Record<string, unknown>): ConditionConfig | null {
  const source = isRecord(config.condition) ? config.condition : config;
  const field = typeof source.field === 'string' ? source.field.trim() : '';
  const rawOperator = typeof source.operator === 'string' ? source.operator.trim() : '';
  const operator = operatorAliases[rawOperator] ?? operatorAliases[rawOperator.toLowerCase()];

  if (!field || !operator) {
    return null;
  }

  if ((operator === 'equals' || operator === 'not_equals') && source.value === undefined) {
    return null;
  }

  return {
    field,
    operator,
    value: source.value
  };
}

function getPath(value: unknown, path: string): { exists: boolean; value: unknown } {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { exists: false, value: undefined };
  }

  let cursor = value;
  for (const part of parts) {
    if (!isRecord(cursor) || !(part in cursor)) {
      return { exists: false, value: undefined };
    }

    cursor = cursor[part];
  }

  return { exists: cursor !== undefined && cursor !== null, value: cursor };
}

function resolveField(input: AutomationNodeExecutionInput, field: string): { exists: boolean; value: unknown } {
  const explicitRootMatch = field.match(/^(context|input|config)\.(.+)$/);
  if (explicitRootMatch) {
    const [, root, path] = explicitRootMatch;
    if (root === 'context') {
      return getPath(input.context, path);
    }
    if (root === 'input') {
      return getPath(input.input, path);
    }
    return getPath(input.node.config, path);
  }

  const contextValue = getPath(input.context, field);
  if (contextValue.exists) {
    return contextValue;
  }

  const inputValue = getPath(input.input, field);
  if (inputValue.exists) {
    return inputValue;
  }

  return getPath(input.node.config, field);
}

function evaluateCondition(config: ConditionConfig, actual: { exists: boolean; value: unknown }): boolean {
  switch (config.operator) {
    case 'equals':
      return actual.exists && actual.value === config.value;
    case 'not_equals':
      return !actual.exists || actual.value !== config.value;
    case 'exists':
      return actual.exists;
    case 'not_exists':
      return !actual.exists;
    case 'is_true':
      return actual.exists && actual.value === true;
    case 'is_false':
      return actual.exists && actual.value === false;
  }
}

function resolveNextNodeIds(input: AutomationNodeExecutionInput, matched: boolean): string[] {
  const desiredHandle = matched ? 'true' : 'false';
  const handledEdges = input.outgoingEdges.filter((edge) => {
    return typeof edge.sourceHandle === 'string' && edge.sourceHandle.trim().toLowerCase() === desiredHandle;
  });

  if (handledEdges.length > 0) {
    return handledEdges.map((edge) => edge.target);
  }

  const defaultEdges = input.outgoingEdges.filter((edge) => {
    return !edge.sourceHandle || edge.sourceHandle.trim().length === 0;
  });

  const fallbackEdges = defaultEdges.length > 0 ? defaultEdges : input.outgoingEdges;
  return fallbackEdges.map((edge) => edge.target);
}

export class ConditionNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'condition';

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const config = normalizeConditionConfig(input.node.config);
    if (!config) {
      return {
        status: 'failed',
        error: {
          message: 'Condition node requires field, operator and value when applicable.',
          nodeId: input.node.id
        }
      };
    }

    const actual = resolveField(input, config.field);
    const matched = evaluateCondition(config, actual);
    const selectedHandle = matched ? 'true' : 'false';
    const nextNodeIds = resolveNextNodeIds(input, matched);

    return {
      status: 'completed',
      nextNodeIds,
      output: {
        matched,
        selectedHandle,
        field: config.field,
        operator: config.operator,
        expectedValue: config.value,
        actualValue: actual.value,
        exists: actual.exists
      }
    };
  }
}
