import type { MembershipRole } from '@prisma/client';
import {
  isPermission,
  resolvePermissionsForMembership,
  type Permission,
  type PermissionOverrides
} from '@/modules/identity/domain/permissions';

export const workspaceModuleCatalog = ['board', 'automation', 'documentation', 'ai', 'settings'] as const;

export type WorkspaceModuleKey = (typeof workspaceModuleCatalog)[number];

export type WorkspaceAccessGroup = {
  id: string;
  name: string;
  description?: string;
  allow?: Permission[];
  deny?: Permission[];
  allowedModules?: WorkspaceModuleKey[];
  allowedBoardViewKeys?: string[];
  ownCardsOnly?: boolean;
};

export type MembershipAccessOverrides = Partial<PermissionOverrides> & {
  groupIds?: string[];
  allowedModules?: WorkspaceModuleKey[];
  allowedBoardViewKeys?: string[];
  ownCardsOnly?: boolean;
};

export type WorkspaceAccessControlConfig = {
  groups: WorkspaceAccessGroup[];
  moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>;
};

export type ResolvedWorkspaceAccessPolicy = {
  permissions: Permission[];
  groupIds: string[];
  allowedModules: WorkspaceModuleKey[];
  moduleEntitlements: Record<WorkspaceModuleKey, boolean>;
  allowedBoardViewKeys: string[] | null;
  ownCardsOnly: boolean;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNormalizedSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePermissionList(input: unknown): Permission[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === 'string')
        .filter((value): value is Permission => isPermission(value))
    )
  );
}

function parseModuleList(input: unknown): WorkspaceModuleKey[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === 'string')
        .filter((value): value is WorkspaceModuleKey =>
          workspaceModuleCatalog.includes(value as WorkspaceModuleKey)
        )
    )
  );
}

function parseBoardViewKeys(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === 'string')
        .map((value) => toNormalizedSlug(value))
        .filter((value) => value.length > 0)
    )
  );
}

function parseBoolean(input: unknown): boolean | undefined {
  return typeof input === 'boolean' ? input : undefined;
}

export function parseMembershipAccessOverrides(input: unknown): MembershipAccessOverrides {
  if (!isObjectRecord(input)) {
    return {};
  }

  return {
    allow: parsePermissionList(input.allow),
    deny: parsePermissionList(input.deny),
    groupIds: Array.from(
      new Set(
        (Array.isArray(input.groupIds) ? input.groupIds : [])
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    ),
    allowedModules: parseModuleList(input.allowedModules),
    allowedBoardViewKeys: parseBoardViewKeys(input.allowedBoardViewKeys),
    ownCardsOnly: parseBoolean(input.ownCardsOnly)
  };
}

function parseAccessGroup(input: unknown): WorkspaceAccessGroup | null {
  if (!isObjectRecord(input) || typeof input.id !== 'string' || typeof input.name !== 'string') {
    return null;
  }

  const id = input.id.trim();
  const name = input.name.trim();
  if (!id || !name) {
    return null;
  }

  const description = typeof input.description === 'string' ? input.description : undefined;
  const ownCardsOnly = parseBoolean(input.ownCardsOnly);

  return {
    id,
    name,
    description,
    allow: parsePermissionList(input.allow),
    deny: parsePermissionList(input.deny),
    allowedModules: parseModuleList(input.allowedModules),
    allowedBoardViewKeys: parseBoardViewKeys(input.allowedBoardViewKeys),
    ownCardsOnly
  };
}

function defaultPlanModuleEntitlements(subscriptionPlan: 'PERSONAL' | 'BUSINESS' | null | undefined) {
  if (subscriptionPlan === 'BUSINESS') {
    return {
      board: true,
      automation: true,
      documentation: true,
      ai: true,
      settings: true
    } as Record<WorkspaceModuleKey, boolean>;
  }

  return {
    board: true,
    automation: false,
    documentation: true,
    ai: false,
    settings: true
  } as Record<WorkspaceModuleKey, boolean>;
}

export function parseWorkspaceAccessControlConfig(workspaceConfig: unknown): WorkspaceAccessControlConfig {
  if (!isObjectRecord(workspaceConfig)) {
    return { groups: [], moduleEntitlements: {} };
  }

  const accessControl = isObjectRecord(workspaceConfig.accessControl) ? workspaceConfig.accessControl : {};
  const groups = Array.isArray(accessControl.groups)
    ? accessControl.groups
        .map((entry) => parseAccessGroup(entry))
        .filter((entry): entry is WorkspaceAccessGroup => entry !== null)
    : [];

  const moduleEntitlementsRecord = isObjectRecord(accessControl.moduleEntitlements)
    ? accessControl.moduleEntitlements
    : {};
  const moduleEntitlements = workspaceModuleCatalog.reduce<Partial<Record<WorkspaceModuleKey, boolean>>>(
    (acc, moduleKey) => {
      if (typeof moduleEntitlementsRecord[moduleKey] === 'boolean') {
        acc[moduleKey] = moduleEntitlementsRecord[moduleKey] as boolean;
      }
      return acc;
    },
    {}
  );

  return { groups, moduleEntitlements };
}

export function upsertWorkspaceAccessControlConfig(
  currentWorkspaceConfig: unknown,
  nextAccessControl: WorkspaceAccessControlConfig
): Record<string, unknown> {
  const current = isObjectRecord(currentWorkspaceConfig) ? currentWorkspaceConfig : {};
  const currentAccessControl = isObjectRecord(current.accessControl) ? current.accessControl : {};

  return {
    ...current,
    accessControl: {
      ...currentAccessControl,
      groups: nextAccessControl.groups,
      moduleEntitlements: nextAccessControl.moduleEntitlements
    }
  };
}

export function resolveWorkspaceAccessPolicy(input: {
  role: MembershipRole;
  membershipPermissions: unknown;
  workspaceConfig: unknown;
  subscriptionPlan: 'PERSONAL' | 'BUSINESS' | null | undefined;
}): ResolvedWorkspaceAccessPolicy {
  const overrides = parseMembershipAccessOverrides(input.membershipPermissions);
  const { groups, moduleEntitlements: workspaceEntitlements } = parseWorkspaceAccessControlConfig(input.workspaceConfig);
  const matchedGroups = (overrides.groupIds ?? [])
    .map((groupId) => groups.find((group) => group.id === groupId))
    .filter((group): group is WorkspaceAccessGroup => Boolean(group));

  const effectivePermissionSet = new Set<Permission>(resolvePermissionsForMembership(input.role, overrides));
  for (const group of matchedGroups) {
    for (const permission of group.allow ?? []) {
      if (isPermission(permission)) {
        effectivePermissionSet.add(permission);
      }
    }
    for (const permission of group.deny ?? []) {
      if (isPermission(permission)) {
        effectivePermissionSet.delete(permission);
      }
    }
  }
  for (const permission of overrides.allow ?? []) {
    if (isPermission(permission)) {
      effectivePermissionSet.add(permission);
    }
  }
  for (const permission of overrides.deny ?? []) {
    if (isPermission(permission)) {
      effectivePermissionSet.delete(permission);
    }
  }

  const planEntitlements = defaultPlanModuleEntitlements(input.subscriptionPlan);
  const moduleEntitlements = workspaceModuleCatalog.reduce<Record<WorkspaceModuleKey, boolean>>((acc, moduleKey) => {
    const workspaceEnabled = workspaceEntitlements[moduleKey];
    acc[moduleKey] = planEntitlements[moduleKey] && workspaceEnabled !== false;
    return acc;
  }, {} as Record<WorkspaceModuleKey, boolean>);

  const groupModuleAllowLists = matchedGroups
    .map((group) => group.allowedModules ?? [])
    .filter((modules) => modules.length > 0);
  const groupModulesUnion = Array.from(new Set(groupModuleAllowLists.flat()));

  const membershipModules = overrides.allowedModules ?? [];
  const baseAllowedModules =
    membershipModules.length > 0
      ? membershipModules
      : groupModulesUnion.length > 0
        ? groupModulesUnion
        : [...workspaceModuleCatalog];
  const allowedModules = baseAllowedModules.filter((moduleKey) => moduleEntitlements[moduleKey]);

  const membershipBoardViews = overrides.allowedBoardViewKeys ?? [];
  const groupBoardViewLists = matchedGroups
    .map((group) => group.allowedBoardViewKeys ?? [])
    .filter((views) => views.length > 0);
  const groupBoardViews = Array.from(new Set(groupBoardViewLists.flat()));
  const allowedBoardViewKeysSource =
    membershipBoardViews.length > 0
      ? membershipBoardViews
      : groupBoardViews.length > 0
        ? groupBoardViews
        : null;
  const allowedBoardViewKeys = allowedBoardViewKeysSource
    ? Array.from(new Set(allowedBoardViewKeysSource.map((value) => toNormalizedSlug(value)).filter(Boolean)))
    : null;

  const ownCardsOnlyFromGroups = matchedGroups.some((group) => group.ownCardsOnly === true);
  const ownCardsOnly = overrides.ownCardsOnly === true || ownCardsOnlyFromGroups;

  return {
    permissions: Array.from(effectivePermissionSet),
    groupIds: overrides.groupIds ?? [],
    allowedModules,
    moduleEntitlements,
    allowedBoardViewKeys,
    ownCardsOnly
  };
}
