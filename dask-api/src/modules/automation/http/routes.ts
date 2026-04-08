import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import type { AutomationService } from '@/modules/automation/application/automation-service';
import { createAutomationRuleDto, runAutomationRuleDto } from '@/modules/automation/http/dto';

export const buildAutomationRoutes = (deps: { automationService: AutomationService }): Router => {
  const router = Router();
  router.use(authMiddleware);

  router.post(
    '/automation/rules',
    asyncHandler(async (req, res) => {
      const input = createAutomationRuleDto.parse(req.body);
      const rule = await deps.automationService.createRule(input);
      res.status(201).json(rule);
    })
  );

  router.post(
    '/automation/rules/:ruleId/run',
    asyncHandler(async (req, res) => {
      const input = runAutomationRuleDto.parse(req.body);
      await deps.automationService.runRule(req.params.ruleId, input.context);
      res.status(202).json({ status: 'queued' });
    })
  );

  return router;
};
