import type { Request, Response } from 'express';
import type { DashboardQueryService } from '@/modules/dashboard/dashboard-query-service';

export class DashboardController {
  public constructor(private readonly queryService: DashboardQueryService) {}

  public getOverview = async (req: Request, res: Response): Promise<void> => {
    const includeAutomation = Boolean(
      req.workspace?.allowedModules?.includes('automation') &&
      req.workspace.effectivePermissions?.includes('automation.runs.read')
    );
    const dashboard = await this.queryService.getOverview({
      workspaceId: req.params.workspaceId,
      userId: req.auth!.userId,
      query: req.query,
      includeAutomation
    });

    res.status(200).json(dashboard);
  };

  public getCrm = async (req: Request, res: Response): Promise<void> => {
    const dashboard = await this.queryService.getCrm({
      workspaceId: req.params.workspaceId,
      userId: req.auth!.userId,
      query: req.query
    });

    res.status(200).json(dashboard);
  };

  public getAutomation = async (req: Request, res: Response): Promise<void> => {
    const dashboard = await this.queryService.getAutomation({
      workspaceId: req.params.workspaceId,
      userId: req.auth!.userId,
      query: req.query
    });

    res.status(200).json(dashboard);
  };

  public getWidgets = async (req: Request, res: Response): Promise<void> => {
    const includeAutomation = Boolean(
      req.workspace?.allowedModules?.includes('automation') &&
      req.workspace.effectivePermissions?.includes('automation.runs.read')
    );
    const dashboard = await this.queryService.getWidgets({
      workspaceId: req.params.workspaceId,
      userId: req.auth!.userId,
      query: req.query,
      includeAutomation
    });

    res.status(200).json(dashboard);
  };
}
