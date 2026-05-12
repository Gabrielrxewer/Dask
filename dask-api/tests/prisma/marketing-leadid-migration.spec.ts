import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  resolve(__dirname, '../../prisma/migrations/20260512143000_marketing_leadid_to_work_item/migration.sql'),
  'utf8'
);
const prismaSchema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');

describe('marketing leadId retirement migration', () => {
  it('backfills productive Marketing links to WorkItem while preserving historical ids', () => {
    expect(migrationSql).toContain('ADD COLUMN "workItemId" TEXT');
    expect(migrationSql).toContain('ADD COLUMN "legacyLeadId" TEXT');
    expect(migrationSql).toContain('i."metadata" #>> \'{legacyLead,leadId}\' = l."id"');
    expect(migrationSql).toContain('i."fields" #>> \'{legacyLeadId}\' = l."id"');
    expect(migrationSql).toContain('DROP COLUMN "leadId"');
    expect(migrationSql).toContain('FOREIGN KEY ("workItemId") REFERENCES "Item"("id")');
  });

  it('migrates active vocabulary and removes metadata.leadId keys', () => {
    expect(migrationSql).toContain("WHEN \"objective\"::text = 'LEAD_NURTURE' THEN 'COMMERCIAL_NURTURE'");
    expect(migrationSql).toContain("WHEN \"entityType\"::text = 'LEAD' AND \"workItemId\" IS NOT NULL THEN 'WORK_ITEM'");
    expect(migrationSql).toContain("WHEN \"entityType\"::text = 'LEAD' THEN 'LEGACY_LEAD'");
    expect(migrationSql).toContain('"metadata" - \'leadId\'');
    expect(migrationSql).toContain('"payload" - \'leadId\'');
  });

  it('keeps historical Lead tables out of the Prisma Client surface', () => {
    for (const modelName of [
      'Lead',
      'LeadActivity',
      'LeadAssignment',
      'LeadNurtureTouch',
      'LeadConversion',
      'LeadIntegrationEvent'
    ]) {
      expect(prismaSchema).toMatch(new RegExp(`model ${modelName} \\{[\\s\\S]*?@@ignore[\\s\\S]*?\\}`));
    }
    expect(prismaSchema).not.toContain('ownedLeads');
    expect(prismaSchema).not.toContain('leads                  Lead[]');
  });
});
