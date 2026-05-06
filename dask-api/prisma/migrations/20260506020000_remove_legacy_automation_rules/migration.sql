ALTER TABLE "AutomationWorkflow"
DROP CONSTRAINT IF EXISTS "AutomationWorkflow_legacyRuleId_fkey";

DROP INDEX IF EXISTS "AutomationWorkflow_workspaceId_legacyRuleId_idx";

ALTER TABLE "AutomationWorkflow"
DROP COLUMN IF EXISTS "legacyRuleId";

DROP TABLE IF EXISTS "AutomationExecution";

DROP TABLE IF EXISTS "AutomationRule";
