-- Rename active commercial runtime vocabulary away from the retired Lead flow.
-- Historical Lead tables/columns are intentionally preserved; this migration only
-- updates WorkItem state slugs, access-control strings, and automation JSON.

CREATE OR REPLACE FUNCTION dask_rename_commercial_vocab(input text)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(
                                      replace(
                                        replace(input,
                                          '"leads"', '"commercial"'),
                                        'lead_captured', 'commercial_work_item_created'),
                                      'lead.captured', 'commercial_work_item.created'),
                                    'lead.hot', 'commercial_work_item.hot'),
                                  'lead.first_contact.sent', 'commercial_work_item.first_contact.sent'),
                                'lead_new', 'commercial_intake'),
                              'lead_qualification', 'commercial_qualification'),
                            'Novo lead', 'Entrada comercial'),
                          'Lead capturado', 'WorkItem comercial criado'),
                        'Lead quente', 'Oportunidade quente'),
                      'lead.transform', 'commercial.transform'),
                    'lead.convert_to_customer', 'commercial.convert_to_customer'),
                  'lead.read', 'commercial.read'),
                'lead.view', 'commercial.view'),
              'lead.capture', 'commercial.capture'),
            'lead.create', 'commercial.create'),
          'lead.update', 'commercial.update'),
        'lead.qualify', 'commercial.qualify'),
      'lead.distribute', 'commercial.distribute'),
    'lead.nurture', 'commercial.nurture')
$$;

CREATE OR REPLACE FUNCTION dask_rename_commercial_permissions(input text)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT replace(
    replace(
      replace(
        replace(
          replace(input,
            'lead.convert', 'commercial.convert'),
          'lead.link_customer', 'commercial.link_customer'),
        'lead.create_billing', 'commercial.create_billing'),
      'lead.import', 'commercial.import'),
    'lead.integration', 'commercial.integration')
$$;

UPDATE "WorkflowState"
SET
  "slug" = CASE "slug"
    WHEN 'lead_new' THEN 'commercial_intake'
    WHEN 'lead_qualification' THEN 'commercial_qualification'
    ELSE "slug"
  END,
  "name" = CASE "slug"
    WHEN 'lead_new' THEN 'Entrada comercial'
    WHEN 'lead_qualification' THEN 'Qualificacao comercial'
    ELSE "name"
  END
WHERE "slug" IN ('lead_new', 'lead_qualification');

UPDATE "BoardColumn"
SET
  "slug" = CASE "slug"
    WHEN 'lead_new' THEN 'commercial_intake'
    WHEN 'lead_qualification' THEN 'commercial_qualification'
    ELSE "slug"
  END,
  "name" = CASE "slug"
    WHEN 'lead_new' THEN 'Entrada comercial'
    WHEN 'lead_qualification' THEN 'Qualificacao comercial'
    ELSE "name"
  END
WHERE "slug" IN ('lead_new', 'lead_qualification');

UPDATE "Item"
SET "status" = CASE "status"
  WHEN 'lead_new' THEN 'commercial_intake'
  WHEN 'lead_qualification' THEN 'commercial_qualification'
  ELSE "status"
END
WHERE "status" IN ('lead_new', 'lead_qualification');

UPDATE "Workspace"
SET "config" = dask_rename_commercial_permissions(dask_rename_commercial_vocab("config"::text))::jsonb
WHERE "config" IS NOT NULL
  AND (
    "config"::text LIKE '%"leads"%'
    OR "config"::text LIKE '%lead%'
  );

UPDATE "WorkspaceMembership"
SET "permissions" = dask_rename_commercial_permissions(dask_rename_commercial_vocab("permissions"::text))::jsonb
WHERE "permissions" IS NOT NULL
  AND (
    "permissions"::text LIKE '%"leads"%'
    OR "permissions"::text LIKE '%lead.%'
  );

UPDATE "AutomationWorkflowVersion"
SET
  "definitionJson" = dask_rename_commercial_permissions(dask_rename_commercial_vocab("definitionJson"::text))::jsonb,
  "graphNodesJson" = CASE
    WHEN "graphNodesJson" IS NULL THEN NULL
    ELSE dask_rename_commercial_permissions(dask_rename_commercial_vocab("graphNodesJson"::text))::jsonb
  END,
  "graphEdgesJson" = CASE
    WHEN "graphEdgesJson" IS NULL THEN NULL
    ELSE dask_rename_commercial_permissions(dask_rename_commercial_vocab("graphEdgesJson"::text))::jsonb
  END
WHERE "definitionJson"::text LIKE '%lead%'
  OR COALESCE("graphNodesJson"::text, '') LIKE '%lead%'
  OR COALESCE("graphEdgesJson"::text, '') LIKE '%lead%';

DROP FUNCTION dask_rename_commercial_permissions(text);
DROP FUNCTION dask_rename_commercial_vocab(text);
