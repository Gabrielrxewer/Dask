import { Router } from 'express';
import { randomUUID } from 'crypto';
import { MembershipRole, Prisma, type PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  requireWorkspaceRole,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import type { WorkspaceCustomersService } from '@/modules/workspace-platform/application/workspace-customers-service';
import type { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import type { WorkspaceInvitesService } from '@/modules/workspace-platform/application/workspace-invites-service';
import type { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';
import {
  boardColumnParamsDto,
  createWorkspaceInviteDto,
  createCustomerDto,
  createBoardColumnDto,
  createCustomFieldDto,
  createItemTypeDto,
  createTagDto,
  createWorkflowStateDto,
  createWorkItemDto,
  customFieldParamsDto,
  customerListQueryDto,
  customerParamsDto,
  customerUserLinkParamsDto,
  fieldValueParamsDto,
  itemTypeParamsDto,
  moveWorkItemDto,
  patchBoardColumnDto,
  patchCustomerDto,
  patchCustomFieldDto,
  createWorkspaceAccessGroupDto,
  patchItemTypeDto,
  replaceItemTypeFieldBindingsDto,
  patchWorkspaceAccessGroupDto,
  patchWorkspaceModuleEntitlementsDto,
  patchPreferencesDto,
  resetWorkspaceTemplateDto,
  patchTagDto,
  patchWorkflowStateDto,
  patchWorkspaceMemberAccessDto,
  patchWorkItemCustomFieldValueDto,
  patchWorkItemDto,
  tagParamsDto,
  transitionWorkItemDto,
  workspaceAccessGroupParamsDto,
  workflowStateParamsDto,
  workspaceMemberAccessParamsDto,
  workspaceInviteParamsDto,
  workspaceDocumentParamsDto,
  workItemParamsDto,
  workItemDocumentParamsDto,
  workItemTagParamsDto,
  workspaceIdParamsDto,
  workspaceSnapshotQueryDto,
  createWorkspaceDocumentDto,
  patchWorkspaceDocumentDto,
  sendWorkspaceDocumentDto
} from '@/modules/workspace-platform/http/dto';
import { permissionCatalog, rolePermissionPresets } from '@/modules/identity/domain/permissions';
import {
  parseMembershipAccessOverrides,
  parseWorkspaceAccessControlConfig,
  resolveWorkspaceAccessPolicy,
  upsertWorkspaceAccessControlConfig,
  workspaceModuleCatalog,
  type WorkspaceAccessGroup,
  type WorkspaceModuleKey
} from '@/modules/identity/domain/access-policy';

export const buildWorkspacePlatformRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  workspaceConfigService: WorkspaceConfigService;
  workspaceCustomersService: WorkspaceCustomersService;
  workspaceDocumentsService: WorkspaceDocumentsService;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
  workspaceInvitesService: WorkspaceInvitesService;
}): Router => {
  const router = Router();
  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireWorkspaceRead = requireWorkspacePermission(deps.authorizationService, 'workspace.read');
  const requireConfigWrite = [
    requireWorkspacePermission(deps.authorizationService, 'workspace.write'),
    requireWorkspaceRole(MembershipRole.ADMIN)
  ];
  const requireItemRead = requireWorkspacePermission(deps.authorizationService, 'item.read');
  const requireItemWrite = [
    requireWorkspacePermission(deps.authorizationService, 'item.write'),
    requireWorkspaceRole(MembershipRole.MEMBER)
  ];

  router.use('/workspaces/:workspaceId', resolveWorkspaceScope, requireWorkspaceRead);

  router.get(
    '/workspaces/:workspaceId/config',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const config = await deps.workspaceConfigService.getWorkspaceConfig({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(config);
    })
  );

  router.get(
    '/workspaces/:workspaceId/access-control',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const memberships = await deps.prisma.workspaceMembership.findMany({
        where: { workspaceId },
        select: {
          userId: true,
          role: true,
          permissions: true,
          user: {
            select: {
              name: true,
              email: true,
              subscriptionPlan: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });
      const accessControlConfig = parseWorkspaceAccessControlConfig(workspace?.config);
      const moduleEntitlements = resolveWorkspaceAccessPolicy({
        role: MembershipRole.OWNER,
        membershipPermissions: {},
        workspaceConfig: workspace?.config,
        subscriptionPlan: memberships[0]?.user.subscriptionPlan ?? null
      }).moduleEntitlements;

      res.status(200).json({
        catalog: permissionCatalog,
        moduleCatalog: workspaceModuleCatalog,
        moduleEntitlements,
        groups: accessControlConfig.groups,
        rolePresets: rolePermissionPresets,
        members: memberships.map((membership) => {
          const overrides = parseMembershipAccessOverrides(membership.permissions);
          const policy = resolveWorkspaceAccessPolicy({
            role: membership.role,
            membershipPermissions: membership.permissions,
            workspaceConfig: workspace?.config,
            subscriptionPlan: membership.user.subscriptionPlan
          });

          return {
            userId: membership.userId,
            name: membership.user.name,
            email: membership.user.email,
            role: membership.role,
            overrides: {
              allow: overrides.allow ?? [],
              deny: overrides.deny ?? [],
              groupIds: overrides.groupIds ?? [],
              allowedModules: overrides.allowedModules ?? [],
              allowedBoardViewKeys: overrides.allowedBoardViewKeys ?? [],
              ownCardsOnly: overrides.ownCardsOnly ?? false
            },
            effectivePermissions: policy.permissions,
            effectiveModules: policy.allowedModules,
            effectiveOwnCardsOnly: policy.ownCardsOnly,
            effectiveBoardViewKeys: policy.allowedBoardViewKeys
          };
        })
      });
    })
  );

  router.patch(
    '/workspaces/:workspaceId/module-entitlements',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = patchWorkspaceModuleEntitlementsDto.parse(req.body);
      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });

      if (!workspace) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const current = parseWorkspaceAccessControlConfig(workspace.config);
      const nextModuleEntitlements = {
        ...current.moduleEntitlements,
        ...payload.moduleEntitlements
      } as Partial<Record<WorkspaceModuleKey, boolean>>;
      const nextConfig = upsertWorkspaceAccessControlConfig(workspace.config, {
        ...current,
        moduleEntitlements: nextModuleEntitlements
      });

      await deps.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          config: nextConfig as Prisma.InputJsonValue
        }
      });

      res.status(200).json({
        moduleCatalog: workspaceModuleCatalog,
        moduleEntitlements: nextModuleEntitlements
      });
    })
  );

  router.post(
    '/workspaces/:workspaceId/access-groups',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWorkspaceAccessGroupDto.parse(req.body);
      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });

      if (!workspace) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const current = parseWorkspaceAccessControlConfig(workspace.config);
      const createdGroup: WorkspaceAccessGroup = {
        id: randomUUID(),
        name: payload.name.trim(),
        description: payload.description,
        allow: payload.allow,
        deny: payload.deny,
        allowedModules: payload.allowedModules as WorkspaceModuleKey[] | undefined,
        allowedBoardViewKeys: payload.allowedBoardViewKeys?.map((value) => value.trim()),
        ownCardsOnly: payload.ownCardsOnly
      };
      const nextConfig = upsertWorkspaceAccessControlConfig(workspace.config, {
        ...current,
        groups: [...current.groups, createdGroup]
      });

      await deps.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          config: nextConfig as Prisma.InputJsonValue
        }
      });

      res.status(201).json(createdGroup);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/access-groups/:groupId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, groupId } = workspaceAccessGroupParamsDto.parse(req.params);
      const payload = patchWorkspaceAccessGroupDto.parse(req.body);
      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });

      if (!workspace) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const current = parseWorkspaceAccessControlConfig(workspace.config);
      const existing = current.groups.find((group) => group.id === groupId);
      if (!existing) {
        res.status(404).json({ message: 'Access group not found.' });
        return;
      }

      const patchedGroup: WorkspaceAccessGroup = {
        ...existing,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.allow !== undefined ? { allow: payload.allow } : {}),
        ...(payload.deny !== undefined ? { deny: payload.deny } : {}),
        ...(payload.allowedModules !== undefined
          ? { allowedModules: payload.allowedModules as WorkspaceModuleKey[] }
          : {}),
        ...(payload.allowedBoardViewKeys !== undefined
          ? { allowedBoardViewKeys: payload.allowedBoardViewKeys.map((value) => value.trim()) }
          : {}),
        ...(payload.ownCardsOnly !== undefined ? { ownCardsOnly: payload.ownCardsOnly } : {})
      };

      const nextConfig = upsertWorkspaceAccessControlConfig(workspace.config, {
        ...current,
        groups: current.groups.map((group) => (group.id === groupId ? patchedGroup : group))
      });

      await deps.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          config: nextConfig as Prisma.InputJsonValue
        }
      });

      res.status(200).json(patchedGroup);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/access-groups/:groupId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, groupId } = workspaceAccessGroupParamsDto.parse(req.params);
      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });

      if (!workspace) {
        res.status(404).json({ message: 'Workspace not found.' });
        return;
      }

      const current = parseWorkspaceAccessControlConfig(workspace.config);
      const exists = current.groups.some((group) => group.id === groupId);
      if (!exists) {
        res.status(404).json({ message: 'Access group not found.' });
        return;
      }

      const nextConfig = upsertWorkspaceAccessControlConfig(workspace.config, {
        ...current,
        groups: current.groups.filter((group) => group.id !== groupId)
      });

      await deps.prisma.$transaction(async (tx) => {
        await tx.workspace.update({
          where: { id: workspaceId },
          data: {
            config: nextConfig as Prisma.InputJsonValue
          }
        });

        const memberships = await tx.workspaceMembership.findMany({
          where: { workspaceId },
          select: { userId: true, permissions: true }
        });

        for (const membership of memberships) {
          const overrides = parseMembershipAccessOverrides(membership.permissions);
          const nextGroupIds = (overrides.groupIds ?? []).filter((id) => id !== groupId);
          const nextOverrides = {
            ...overrides,
            groupIds: nextGroupIds
          };

          const hasAnyOverride =
            (nextOverrides.allow?.length ?? 0) > 0 ||
            (nextOverrides.deny?.length ?? 0) > 0 ||
            (nextOverrides.groupIds?.length ?? 0) > 0 ||
            (nextOverrides.allowedModules?.length ?? 0) > 0 ||
            (nextOverrides.allowedBoardViewKeys?.length ?? 0) > 0 ||
            nextOverrides.ownCardsOnly === true;

          await tx.workspaceMembership.update({
            where: {
              workspaceId_userId: {
                workspaceId,
                userId: membership.userId
              }
            },
            data: {
              permissions: hasAnyOverride ? (nextOverrides as Prisma.InputJsonValue) : Prisma.JsonNull
            }
          });
        }
      });

      res.status(204).send();
    })
  );

  router.patch(
    '/workspaces/:workspaceId/members/:memberUserId/access-control',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, memberUserId } = workspaceMemberAccessParamsDto.parse(req.params);
      const payload = patchWorkspaceMemberAccessDto.parse(req.body);

      const membership = await deps.prisma.workspaceMembership.findFirst({
        where: {
          workspaceId,
          userId: memberUserId
        },
        select: {
          role: true
        }
      });

      if (!membership) {
        res.status(404).json({ message: 'Workspace membership not found.' });
        return;
      }

      if (req.workspace?.role !== MembershipRole.OWNER) {
        if (payload.role === MembershipRole.OWNER || membership.role === MembershipRole.OWNER) {
          res.status(403).json({ message: 'Only owner can assign or edit owner access.' });
          return;
        }
      }

      const currentMembership = await deps.prisma.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberUserId
          }
        },
        select: {
          permissions: true
        }
      });
      const existingOverrides = parseMembershipAccessOverrides(currentMembership?.permissions);

      const workspace = await deps.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { config: true }
      });
      const groups = parseWorkspaceAccessControlConfig(workspace?.config).groups;

      const nextGroupIdsInput = payload.permissions?.groupIds ?? existingOverrides.groupIds ?? [];
      const nextGroupIds = Array.from(new Set(nextGroupIdsInput));
      const unknownGroup = nextGroupIds.find((groupId) => !groups.some((group) => group.id === groupId));
      if (unknownGroup) {
        res.status(422).json({ message: `Unknown access group id '${unknownGroup}'.` });
        return;
      }

      const nextPermissionsObject = {
        allow: Array.from(new Set(payload.permissions?.allow ?? existingOverrides.allow ?? [])),
        deny: Array.from(new Set(payload.permissions?.deny ?? existingOverrides.deny ?? [])),
        groupIds: nextGroupIds,
        allowedModules: Array.from(
          new Set(payload.permissions?.allowedModules ?? existingOverrides.allowedModules ?? [])
        ),
        allowedBoardViewKeys: Array.from(
          new Set(payload.permissions?.allowedBoardViewKeys ?? existingOverrides.allowedBoardViewKeys ?? [])
        ),
        ownCardsOnly:
          payload.permissions?.ownCardsOnly !== undefined
            ? payload.permissions.ownCardsOnly
            : existingOverrides.ownCardsOnly
      };

      const hasAnyOverride =
        nextPermissionsObject.allow.length > 0 ||
        nextPermissionsObject.deny.length > 0 ||
        nextPermissionsObject.groupIds.length > 0 ||
        nextPermissionsObject.allowedModules.length > 0 ||
        nextPermissionsObject.allowedBoardViewKeys.length > 0 ||
        nextPermissionsObject.ownCardsOnly === true;

      const nextPermissions = hasAnyOverride ? nextPermissionsObject : Prisma.JsonNull;

      const updated = await deps.prisma.workspaceMembership.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberUserId
          }
        },
        data: {
          role: payload.role,
          permissions: nextPermissions
        },
        select: {
          userId: true,
          role: true,
          permissions: true
        }
      });

      res.status(200).json(updated);
    })
  );

  router.put(
    '/workspaces/:workspaceId/customers/:customerId/users/:memberUserId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, customerId, memberUserId } = customerUserLinkParamsDto.parse(req.params);
      const [customer, membership] = await Promise.all([
        deps.prisma.customer.findFirst({
          where: { id: customerId, workspaceId },
          select: { id: true }
        }),
        deps.prisma.workspaceMembership.findFirst({
          where: { workspaceId, userId: memberUserId },
          select: { userId: true, role: true }
        })
      ]);

      if (!customer || !membership) {
        res.status(404).json({ message: 'Customer or workspace membership not found.' });
        return;
      }

      const link = await deps.prisma.workspaceCustomerUser.upsert({
        where: {
          workspaceId_customerId_userId: {
            workspaceId,
            customerId,
            userId: memberUserId
          }
        },
        create: {
          workspaceId,
          customerId,
          userId: memberUserId,
          createdBy: req.auth!.userId
        },
        update: {},
        select: {
          id: true,
          workspaceId: true,
          customerId: true,
          userId: true
        }
      });

      res.status(200).json(link);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/customers/:customerId/users/:memberUserId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, customerId, memberUserId } = customerUserLinkParamsDto.parse(req.params);
      await deps.prisma.workspaceCustomerUser.deleteMany({
        where: {
          workspaceId,
          customerId,
          userId: memberUserId
        }
      });
      res.status(204).send();
    })
  );

  router.get(
    '/workspaces/:workspaceId/invites',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const invites = await deps.workspaceInvitesService.listWorkspaceInvites({ workspaceId });
      res.status(200).json(invites);
    })
  );

  router.post(
    '/workspaces/:workspaceId/invites',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWorkspaceInviteDto.parse(req.body);
      const invite = await deps.workspaceInvitesService.createOrResendInvite({
        workspaceId,
        email: payload.email,
        role: payload.role,
        invitedByUserId: req.auth!.userId
      });
      res.status(201).json(invite);
    })
  );

  router.post(
    '/workspaces/:workspaceId/invites/:inviteId/resend',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, inviteId } = workspaceInviteParamsDto.parse(req.params);
      const invite = await deps.workspaceInvitesService.resendInvite({
        workspaceId,
        inviteId,
        requestedByUserId: req.auth!.userId
      });
      res.status(200).json(invite);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/invites/:inviteId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, inviteId } = workspaceInviteParamsDto.parse(req.params);
      await deps.workspaceInvitesService.revokeInvite({ workspaceId, inviteId });
      res.status(204).send();
    })
  );

  router.get(
    '/workspaces/:workspaceId/customers',
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const query = customerListQueryDto.parse(req.query ?? {});
      const customers = await deps.workspaceCustomersService.listCustomers({
        workspaceId,
        userId: req.auth!.userId,
        search: query.search,
        status: query.status
      });
      res.status(200).json(customers);
    })
  );

  router.post(
    '/workspaces/:workspaceId/customers',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createCustomerDto.parse(req.body ?? {});
      const customer = await deps.workspaceCustomersService.createCustomer({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(customer);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/customers/:customerId',
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, customerId } = customerParamsDto.parse(req.params);
      const payload = patchCustomerDto.parse(req.body ?? {});
      const customer = await deps.workspaceCustomersService.updateCustomer({
        workspaceId,
        customerId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(customer);
    })
  );

  router.get(
    '/workspaces/:workspaceId/item-types',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const itemTypes = await deps.workspaceConfigService.listItemTypes({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(itemTypes);
    })
  );

  router.post(
    '/workspaces/:workspaceId/item-types',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.createItemType({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(itemType);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/item-types/:typeId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { typeId } = itemTypeParamsDto.parse(req.params);
      const payload = patchItemTypeDto.parse(req.body);
      const itemType = await deps.workspaceConfigService.updateItemType({
        workspaceId: req.workspace!.id,
        typeId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(itemType);
    })
  );

  router.put(
    '/workspaces/:workspaceId/item-types/:typeId/field-bindings',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { typeId } = itemTypeParamsDto.parse(req.params);
      const payload = replaceItemTypeFieldBindingsDto.parse(req.body);
      await deps.workspaceConfigService.replaceItemTypeFieldBindings({
        workspaceId: req.workspace!.id,
        typeId,
        userId: req.auth!.userId,
        payload
      });
      res.status(204).send();
    })
  );

  router.get(
    '/workspaces/:workspaceId/workflow-states',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const states = await deps.workspaceConfigService.listWorkflowStates({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(states);
    })
  );

  router.post(
    '/workspaces/:workspaceId/workflow-states',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.createWorkflowState({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(state);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/workflow-states/:stateId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { stateId } = workflowStateParamsDto.parse(req.params);
      const payload = patchWorkflowStateDto.parse(req.body);
      const state = await deps.workspaceConfigService.updateWorkflowState({
        workspaceId: req.workspace!.id,
        stateId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(state);
    })
  );

  router.get(
    '/workspaces/:workspaceId/board-columns',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const columns = await deps.workspaceConfigService.listBoardColumns({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(columns);
    })
  );

  router.post(
    '/workspaces/:workspaceId/board-columns',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.createBoardColumn({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(column);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/board-columns/:columnId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { columnId } = boardColumnParamsDto.parse(req.params);
      const payload = patchBoardColumnDto.parse(req.body);
      const column = await deps.workspaceConfigService.updateBoardColumn({
        workspaceId: req.workspace!.id,
        columnId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(column);
    })
  );

  router.get(
    '/workspaces/:workspaceId/tags',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const tags = await deps.workspaceConfigService.listTags({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(tags);
    })
  );

  router.post(
    '/workspaces/:workspaceId/tags',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.createTag({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(tag);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/tags/:tagId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { tagId } = tagParamsDto.parse(req.params);
      const payload = patchTagDto.parse(req.body);
      const tag = await deps.workspaceConfigService.updateTag({
        workspaceId: req.workspace!.id,
        tagId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(tag);
    })
  );

  router.get(
    '/workspaces/:workspaceId/custom-fields',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const fields = await deps.workspaceConfigService.listCustomFields({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(fields);
    })
  );

  router.post(
    '/workspaces/:workspaceId/custom-fields',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = createCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.createCustomField({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(field);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/custom-fields/:fieldId',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const { fieldId } = customFieldParamsDto.parse(req.params);
      const payload = patchCustomFieldDto.parse(req.body);
      const field = await deps.workspaceConfigService.updateCustomField({
        workspaceId: req.workspace!.id,
        fieldId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(field);
    })
  );

  router.get(
    '/workspaces/:workspaceId/preferences',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const preferences = await deps.workspaceConfigService.getPreferences({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(preferences);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/preferences',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = patchPreferencesDto.parse(req.body);
      const preferences = await deps.workspaceConfigService.updatePreferences({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(preferences);
    })
  );

  router.post(
    '/workspaces/:workspaceId/reset-template',
    ...requireConfigWrite,
    asyncHandler(async (req, res) => {
      const payload = resetWorkspaceTemplateDto.parse(req.body ?? {});
      const config = await deps.workspaceConfigService.resetWorkspaceToTemplate({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        templateKey: payload.templateKey
      });
      res.status(200).json(config);
    })
  );

  router.get(
    '/workspaces/:workspaceId/snapshot',
    requireWorkspaceModule('board'),
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const { limit } = workspaceSnapshotQueryDto.parse(req.query);
      const snapshot = await deps.workspaceWorkItemsService.getWorkspaceSnapshot({
        workspaceId,
        userId: req.auth!.userId,
        limit
      });
      res.status(200).json(snapshot);
    })
  );

  router.get(
    '/workspaces/:workspaceId/work-items',
    requireWorkspaceModule('board'),
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const items = await deps.workspaceWorkItemsService.listWorkItems({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(items);
    })
  );

  router.get(
    '/workspaces/:workspaceId/work-items/:itemId/documents',
    requireWorkspaceModule('board'),
    requireWorkspaceModule('documentation'),
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId } = workItemParamsDto.parse(req.params);
      const documents = await deps.workspaceWorkItemsService.listLinkedDocuments({
        workspaceId,
        itemId,
        userId: req.auth!.userId
      });
      res.status(200).json(documents);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/documents/:documentId',
    requireWorkspaceModule('board'),
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId, documentId } = workItemDocumentParamsDto.parse(req.params);
      const documents = await deps.workspaceWorkItemsService.linkDocumentToWorkItem({
        workspaceId,
        itemId,
        documentId,
        userId: req.auth!.userId
      });
      res.status(200).json(documents);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/work-items/:itemId/documents/:documentId',
    requireWorkspaceModule('board'),
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, itemId, documentId } = workItemDocumentParamsDto.parse(req.params);
      await deps.workspaceWorkItemsService.unlinkDocumentFromWorkItem({
        workspaceId,
        itemId,
        documentId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  router.get(
    '/workspaces/:workspaceId/documents',
    requireWorkspaceModule('documentation'),
    requireItemRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const documents = await deps.workspaceDocumentsService.listDocuments({
        workspaceId,
        userId: req.auth!.userId
      });
      res.status(200).json(documents);
    })
  );

  router.post(
    '/workspaces/:workspaceId/documents',
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceIdParamsDto.parse(req.params);
      const payload = createWorkspaceDocumentDto.parse(req.body);
      const document = await deps.workspaceDocumentsService.createDocument({
        workspaceId,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(document);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/documents/:documentId',
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = workspaceDocumentParamsDto.parse(req.params);
      const payload = patchWorkspaceDocumentDto.parse(req.body);
      const document = await deps.workspaceDocumentsService.updateDocument({
        workspaceId,
        documentId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(document);
    })
  );

  router.post(
    '/workspaces/:workspaceId/documents/:documentId/send',
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = workspaceDocumentParamsDto.parse(req.params);
      const payload = sendWorkspaceDocumentDto.parse(req.body);
      const document = await deps.workspaceDocumentsService.sendCommercialDocument({
        workspaceId,
        documentId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(document);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/documents/:documentId',
    requireWorkspaceModule('documentation'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = workspaceDocumentParamsDto.parse(req.params);
      await deps.workspaceDocumentsService.deleteDocument({
        workspaceId,
        documentId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const payload = createWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.createWorkItem({
        workspaceId: req.workspace!.id,
        userId: req.auth!.userId,
        payload
      });
      res.status(201).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = patchWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.updateWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/work-items/:itemId',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      await deps.workspaceWorkItemsService.deleteWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/move',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = moveWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.moveWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/transitions',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId } = workItemParamsDto.parse(req.params);
      const payload = transitionWorkItemDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.transitionWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        userId: req.auth!.userId,
        payload
      });
      res.status(200).json(item);
    })
  );

  router.patch(
    '/workspaces/:workspaceId/work-items/:itemId/custom-fields/:fieldId',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, fieldId } = fieldValueParamsDto.parse(req.params);
      const payload = patchWorkItemCustomFieldValueDto.parse(req.body);
      const item = await deps.workspaceWorkItemsService.setWorkItemCustomFieldValue({
        workspaceId: req.workspace!.id,
        itemId,
        fieldId,
        userId: req.auth!.userId,
        value: payload.value
      });
      res.status(200).json(item);
    })
  );

  router.post(
    '/workspaces/:workspaceId/work-items/:itemId/tags/:tagId',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, tagId } = workItemTagParamsDto.parse(req.params);
      const item = await deps.workspaceWorkItemsService.addTagToWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(200).json(item);
    })
  );

  router.delete(
    '/workspaces/:workspaceId/work-items/:itemId/tags/:tagId',
    requireWorkspaceModule('board'),
    ...requireItemWrite,
    asyncHandler(async (req, res) => {
      const { itemId, tagId } = workItemTagParamsDto.parse(req.params);
      await deps.workspaceWorkItemsService.removeTagFromWorkItem({
        workspaceId: req.workspace!.id,
        itemId,
        tagId,
        userId: req.auth!.userId
      });
      res.status(204).send();
    })
  );

  return router;
};

