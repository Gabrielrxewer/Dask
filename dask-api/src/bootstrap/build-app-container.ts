import Stripe from 'stripe';
import { EventPublisher } from '@/core/events/event-publisher';
import { env } from '@/core/config/env';
import { prisma } from '@/infra/db/prisma';
import { PrismaOutboxRepository } from '@/infra/db/prisma-outbox-repository';
import { BullMqJobQueue } from '@/infra/queue/bullmq-job-queue';
import { MockEmailService } from '@/infra/email/mock-email-service';
import { ResendEmailService } from '@/infra/email/resend-email-service';
import { AuthService } from '@/modules/identity/application/auth-service';
import { OrganizationService } from '@/modules/identity/application/organization-service';
import { PasswordService } from '@/modules/identity/application/password-service';
import { RoleAuthorizationService } from '@/modules/identity/application/role-authorization-service';
import { PrismaIdentityRepository } from '@/modules/identity/repositories/prisma-identity-repository';
import { WorkspacesService } from '@/modules/workspaces/application/workspaces-service';
import { PrismaWorkspacesRepository } from '@/modules/workspaces/repositories/prisma-workspaces-repository';
import { ItemsService } from '@/modules/items/application/items-service';
import { PrismaItemsRepository } from '@/modules/items/repositories/prisma-items-repository';
import { ImprovementRequestService } from '@/modules/ai/application/improvement-request-service';
import { AIAgentService } from '@/modules/ai/application/ai-agent-service';
import { PrismaAIAgentRepository } from '@/modules/ai/repositories/prisma-ai-agent-repository';
import { IndexingRequestService } from '@/modules/search/application/indexing-request-service';
import { HybridSearchService } from '@/modules/search/application/hybrid-search-service';
import { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import { AutomationBusinessActionService } from '@/modules/automation/application/automation-business-action-service';
import { AutomationRunService } from '@/modules/automation/application/automation-run-service';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationRunObservabilityService } from '@/modules/automation/application/automation-run-observability-service';
import { AutomationScheduledStepService } from '@/modules/automation/application/automation-scheduled-step-service';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { AutomationStepRunService } from '@/modules/automation/application/automation-step-run-service';
import { AutomationViewService } from '@/modules/automation/application/automation-view-service';
import { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';
import { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';
import { AutomationWorkflowVersionService } from '@/modules/automation/application/workflow-version-service';
import { AutomationScheduledStepProcessor } from '@/modules/automation/runtime/automation-scheduled-step-processor';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';
import { IntegrationService } from '@/modules/integration/application/integration-service';
import { AuditService } from '@/modules/audit/application/audit-service';
import { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import { WorkspaceCustomersService } from '@/modules/workspace-platform/application/workspace-customers-service';
import { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';
import { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';
import { WorkspaceInvitesService } from '@/modules/workspace-platform/application/workspace-invites-service';
import { CustomerAccountLinker } from '@/modules/portal/application/customer-account-linker';
import { BillingService } from '@/modules/billing/application/billing-service';
import { PrismaBillingRepository } from '@/modules/billing/repositories/prisma-billing-repository';
import { FiscalService } from '@/modules/fiscal/application/fiscal-service';
import { FocusFiscalProvider } from '@/modules/fiscal/providers/focus/focus-fiscal-provider';
import { PrismaFiscalRepository } from '@/modules/fiscal/repositories/prisma-fiscal-repository';
import { CommercialIntakeService } from '@/modules/commercial-intake/application/commercial-intake-service';
import { MarketingService } from '@/modules/marketing/application/marketing-service';
import { MockMarketingEmailProvider } from '@/modules/marketing/providers/mock-marketing-email-provider';
import { ResendMarketingEmailProvider } from '@/modules/marketing/providers/resend-marketing-email-provider';
import { PrismaMarketingRepository } from '@/modules/marketing/repositories/prisma-marketing-repository';
import { DashboardFiltersService } from '@/modules/dashboard/dashboard-filters-service';
import { DashboardMetricsService } from '@/modules/dashboard/dashboard-metrics-service';
import { DashboardQueryService } from '@/modules/dashboard/dashboard-query-service';
import { PrismaDashboardRepository } from '@/modules/dashboard/dashboard-repository';
import { DashboardWidgetsService } from '@/modules/dashboard/dashboard-widgets-service';
import { buildAIProviderStack } from '@/infra/providers/ai/build-ai-provider-stack';

export type AppContainer = {
  roleAuthorizationService: RoleAuthorizationService;
  authService: AuthService;
  organizationService: OrganizationService;
  workspacesService: WorkspacesService;
  itemsService: ItemsService;
  improvementRequestService: ImprovementRequestService;
  aiAgentService: AIAgentService;
  indexingRequestService: IndexingRequestService;
  hybridSearchService: HybridSearchService;
  automationAIService: AutomationAIService;
  automationApprovalRequestService: AutomationApprovalRequestService;
  automationWorkflowService: AutomationWorkflowService;
  automationWorkflowVersionService: AutomationWorkflowVersionService;
  automationRunService: AutomationRunService;
  automationRunObservabilityService: AutomationRunObservabilityService;
  automationRunEventService: AutomationRunEventService;
  automationSideEffectService: AutomationSideEffectService;
  automationWorkflowRunnerService: AutomationWorkflowRunnerService;
  automationStepRunService: AutomationStepRunService;
  automationScheduledStepService: AutomationScheduledStepService;
  automationWorkflowExecutor: AutomationWorkflowExecutor;
  automationScheduledStepProcessor: AutomationScheduledStepProcessor;
  automationViewService: AutomationViewService;
  integrationService: IntegrationService;
  auditService: AuditService;
  workspaceConfigService: WorkspaceConfigService;
  workspaceCustomersService: WorkspaceCustomersService;
  workspaceDocumentsService: WorkspaceDocumentsService;
  workspaceWorkItemsService: WorkspaceWorkItemsService;
  workspaceInvitesService: WorkspaceInvitesService;
  billingService: BillingService | null;
  fiscalService: FiscalService;
  commercialIntakeService: CommercialIntakeService;
  marketingService: MarketingService;
  dashboardQueryService: DashboardQueryService;
};

export function buildAppContainer(): AppContainer {
  const outboxRepository = new PrismaOutboxRepository(prisma);
  const eventPublisher = new EventPublisher(outboxRepository, prisma);
  const jobQueue = new BullMqJobQueue();

  const identityRepository = new PrismaIdentityRepository(prisma);
  const workspacesRepository = new PrismaWorkspacesRepository(prisma);
  const itemsRepository = new PrismaItemsRepository(prisma);

  const passwordService = new PasswordService(env.HASH_PEPPER);
  const emailService = env.RESEND_API_KEY ? new ResendEmailService() : new MockEmailService();
  const workspaceInvitesService = new WorkspaceInvitesService(prisma, emailService);
  const customerAccountLinker = new CustomerAccountLinker(prisma);
  const authService = new AuthService(
    identityRepository,
    passwordService,
    emailService,
    workspaceInvitesService,
    customerAccountLinker
  );
  const organizationService = new OrganizationService(identityRepository, eventPublisher);
  const roleAuthorizationService = new RoleAuthorizationService(prisma);
  const workspacesService = new WorkspacesService(workspacesRepository, eventPublisher);
  const itemsService = new ItemsService(itemsRepository, eventPublisher, prisma);
  const workspaceConfigService = new WorkspaceConfigService(prisma);
  const workspaceDocumentsService = new WorkspaceDocumentsService(
    prisma,
    workspaceConfigService,
    eventPublisher,
    emailService
  );
  const { aiProvider, embeddingProvider } = buildAIProviderStack();
  const workspaceWorkItemsService = new WorkspaceWorkItemsService(
    prisma,
    workspaceConfigService,
    eventPublisher
  );
  const workspaceCustomersService = new WorkspaceCustomersService(prisma, workspaceConfigService, eventPublisher);
  const billingRepo = new PrismaBillingRepository(prisma);
  const stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  const billingService = stripeClient
    ? new BillingService({
        repo: billingRepo,
        stripe: stripeClient,
        appPublicUrl: env.APP_PUBLIC_URL,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
        portalTokenSecret: env.BILLING_PORTAL_TOKEN_SECRET ?? env.JWT_SECRET,
        emailService,
        eventPublisher,
        priceIds: {
          PERSONAL: env.STRIPE_PRICE_ID_PERSONAL_MONTHLY ?? '',
          BUSINESS: env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? ''
        },
        connectApplicationFeeBps: env.STRIPE_CONNECT_APPLICATION_FEE_BPS
      })
    : null;
  const automationBusinessActionService = new AutomationBusinessActionService({
    prisma,
    workItemsService: workspaceWorkItemsService,
    documentsService: workspaceDocumentsService,
    customersService: workspaceCustomersService,
    billingService,
    authorizationService: roleAuthorizationService
  });
  const improvementRequestService = new ImprovementRequestService(itemsRepository, eventPublisher);
  const indexingRequestService = new IndexingRequestService(itemsRepository, eventPublisher);
  const hybridSearchService = new HybridSearchService(prisma, embeddingProvider);
  const aiAgentRepository = new PrismaAIAgentRepository(prisma);
  const automationAIService = new AutomationAIService(prisma, aiProvider);
  const automationWorkflowService = new AutomationWorkflowService(prisma);
  const automationWorkflowVersionService = new AutomationWorkflowVersionService(prisma);
  const automationRunEventService = new AutomationRunEventService(prisma);
  const automationApprovalRequestService = new AutomationApprovalRequestService(prisma, {
    eventService: automationRunEventService
  });
  const automationSideEffectService = new AutomationSideEffectService(prisma, {
    eventService: automationRunEventService
  });
  const automationRunService = new AutomationRunService(prisma, automationRunEventService);
  const automationRunObservabilityService = new AutomationRunObservabilityService(prisma);
  const automationStepRunService = new AutomationStepRunService(prisma);
  const automationScheduledStepService = new AutomationScheduledStepService(prisma);
  const automationWorkflowExecutor = new AutomationWorkflowExecutor(prisma, {
    eventService: automationRunEventService,
    sideEffectService: automationSideEffectService,
    aiService: automationAIService,
    approvalRequestService: automationApprovalRequestService,
    businessActionService: automationBusinessActionService
  });
  const automationScheduledStepProcessor = new AutomationScheduledStepProcessor(prisma, {
    eventService: automationRunEventService,
    workflowExecutor: automationWorkflowExecutor
  });
  const automationWorkflowRunnerService = new AutomationWorkflowRunnerService(prisma, {
    eventService: automationRunEventService,
    workflowExecutor: automationWorkflowExecutor
  });
  const aiAgentService = new AIAgentService(
    prisma,
    aiAgentRepository,
    aiProvider,
    hybridSearchService,
    roleAuthorizationService,
    eventPublisher,
    {
      workflowService: automationWorkflowService,
      workflowVersionService: automationWorkflowVersionService,
      workflowRunnerService: automationWorkflowRunnerService
    }
  );
  const automationViewService = new AutomationViewService(prisma, workspaceConfigService);
  const integrationService = new IntegrationService(eventPublisher);
  const auditService = new AuditService(prisma);

  const fiscalRepo = new PrismaFiscalRepository(prisma);
  const focusProvider = new FocusFiscalProvider();
  const fiscalService = new FiscalService({
    repo: fiscalRepo,
    provider: focusProvider,
    jobQueue,
    stripe: stripeClient,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET_FISCAL ?? env.STRIPE_WEBHOOK_SECRET,
    focusWebhookSecret: env.FOCUS_WEBHOOK_SECRET
  });
  const commercialIntakeService = new CommercialIntakeService({
    prisma,
    workspaceWorkItemsService,
    webhookSecret: env.LEADS_WEBHOOK_SECRET
  });
  const marketingRepo = new PrismaMarketingRepository(prisma);
  const marketingEmailProvider = env.RESEND_API_KEY
    ? new ResendMarketingEmailProvider()
    : new MockMarketingEmailProvider();
  const marketingService = new MarketingService({
    repo: marketingRepo,
    eventPublisher,
    jobQueue,
    aiProvider,
    emailProvider: marketingEmailProvider,
    automationWorkflowService,
    automationWorkflowVersionService,
    workspaceWorkItemsService
  });
  const dashboardFiltersService = new DashboardFiltersService();
  const dashboardRepository = new PrismaDashboardRepository(prisma);
  const dashboardMetricsService = new DashboardMetricsService(dashboardRepository);
  const dashboardWidgetsService = new DashboardWidgetsService(dashboardFiltersService);
  const dashboardQueryService = new DashboardQueryService(
    prisma,
    workspaceConfigService,
    dashboardFiltersService,
    dashboardMetricsService,
    dashboardWidgetsService
  );

  return {
    roleAuthorizationService,
    authService,
    organizationService,
    workspacesService,
    itemsService,
    improvementRequestService,
    aiAgentService,
    indexingRequestService,
    hybridSearchService,
    automationAIService,
    automationApprovalRequestService,
    automationWorkflowService,
    automationWorkflowVersionService,
    automationRunService,
    automationRunObservabilityService,
    automationRunEventService,
    automationSideEffectService,
    automationWorkflowRunnerService,
    automationStepRunService,
    automationScheduledStepService,
    automationWorkflowExecutor,
    automationScheduledStepProcessor,
    automationViewService,
    integrationService,
    auditService,
    workspaceConfigService,
    workspaceCustomersService,
    workspaceDocumentsService,
    workspaceWorkItemsService,
    workspaceInvitesService,
    billingService,
    fiscalService,
    commercialIntakeService,
    marketingService,
    dashboardQueryService
  };
}
