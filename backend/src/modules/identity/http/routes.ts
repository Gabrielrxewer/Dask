import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { AuthService } from '@/modules/identity/application/auth-service';
import type { OrganizationService } from '@/modules/identity/application/organization-service';
import { createOrganizationDto, loginDto, registerDto } from '@/modules/identity/http/dto';

export const buildIdentityRoutes = (deps: {
  authService: AuthService;
  organizationService: OrganizationService;
}): Router => {
  const router = Router();

  router.post(
    '/auth/register',
    asyncHandler(async (req, res) => {
      const input = registerDto.parse(req.body);
      const result = await deps.authService.register(input);
      res.status(201).json(result);
    })
  );

  router.post(
    '/auth/login',
    asyncHandler(async (req, res) => {
      const input = loginDto.parse(req.body);
      const result = await deps.authService.login(input);
      res.status(200).json(result);
    })
  );

  router.post(
    '/organizations',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const input = createOrganizationDto.parse(req.body);
      const organization = await deps.organizationService.createOrganization({
        ...input,
        ownerUserId: req.auth!.userId
      });
      res.status(201).json(organization);
    })
  );

  return router;
};
