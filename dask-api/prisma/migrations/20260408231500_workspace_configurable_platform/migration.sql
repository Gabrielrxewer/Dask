-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM (
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'DATETIME',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'USER'
);

-- DropEnum dependency by converting Item.type to text
ALTER TABLE "Item"
ALTER COLUMN "type" TYPE TEXT
USING "type"::TEXT;

DROP TYPE IF EXISTS "ItemType";

ALTER TABLE "Item"
ALTER COLUMN "type" SET DEFAULT 'task',
ALTER COLUMN "status" SET DEFAULT 'backlog';

ALTER TABLE "Item"
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "boardColumnId" TEXT,
ADD COLUMN "checklist" JSONB,
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "parentId" TEXT,
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stateId" TEXT,
ADD COLUMN "typeId" TEXT,
ADD COLUMN "updatedBy" TEXT;

-- CreateTable
CREATE TABLE "WorkItemType" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT NOT NULL,
  "icon" TEXT,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "usageRules" JSONB,
  "acceptsParent" BOOLEAN NOT NULL DEFAULT true,
  "acceptsChecklist" BOOLEAN NOT NULL DEFAULT true,
  "acceptsDueDate" BOOLEAN NOT NULL DEFAULT true,
  "acceptsAssignee" BOOLEAN NOT NULL DEFAULT true,
  "acceptsTags" BOOLEAN NOT NULL DEFAULT true,
  "acceptsCustomFields" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkItemType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowState" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" TEXT,
  "color" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "isEditable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoardColumn" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "wipLimit" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ColumnStateMapping" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "columnId" TEXT NOT NULL,
  "stateId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ColumnStateMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TagDefinition" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TagDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspacePreferences" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "defaultBoardMode" TEXT NOT NULL DEFAULT 'board',
  "dateFormat" TEXT NOT NULL DEFAULT 'dd/mm/yyyy',
  "visibleCardFieldIds" JSONB,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkspacePreferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldDefinition" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "type" "CustomFieldType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldOption" (
  "id" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "color" TEXT,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomFieldOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldScope" (
  "id" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomFieldScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomFieldValue" (
  "id" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkItemTag" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkItemTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemType_workspaceId_slug_key" ON "WorkItemType"("workspaceId", "slug");
CREATE INDEX "WorkItemType_workspaceId_isActive_idx" ON "WorkItemType"("workspaceId", "isActive");

CREATE UNIQUE INDEX "WorkflowState_workspaceId_slug_key" ON "WorkflowState"("workspaceId", "slug");
CREATE INDEX "WorkflowState_workspaceId_isActive_idx" ON "WorkflowState"("workspaceId", "isActive");

CREATE UNIQUE INDEX "BoardColumn_workspaceId_slug_key" ON "BoardColumn"("workspaceId", "slug");
CREATE INDEX "BoardColumn_workspaceId_isActive_idx" ON "BoardColumn"("workspaceId", "isActive");

CREATE UNIQUE INDEX "ColumnStateMapping_columnId_stateId_key" ON "ColumnStateMapping"("columnId", "stateId");
CREATE INDEX "ColumnStateMapping_workspaceId_columnId_idx" ON "ColumnStateMapping"("workspaceId", "columnId");
CREATE INDEX "ColumnStateMapping_workspaceId_stateId_idx" ON "ColumnStateMapping"("workspaceId", "stateId");

CREATE UNIQUE INDEX "TagDefinition_workspaceId_slug_key" ON "TagDefinition"("workspaceId", "slug");
CREATE INDEX "TagDefinition_workspaceId_isActive_idx" ON "TagDefinition"("workspaceId", "isActive");

CREATE UNIQUE INDEX "WorkspacePreferences_workspaceId_key" ON "WorkspacePreferences"("workspaceId");

CREATE UNIQUE INDEX "CustomFieldDefinition_workspaceId_slug_key" ON "CustomFieldDefinition"("workspaceId", "slug");
CREATE INDEX "CustomFieldDefinition_workspaceId_isActive_idx" ON "CustomFieldDefinition"("workspaceId", "isActive");

CREATE UNIQUE INDEX "CustomFieldOption_fieldId_value_key" ON "CustomFieldOption"("fieldId", "value");
CREATE INDEX "CustomFieldOption_fieldId_position_idx" ON "CustomFieldOption"("fieldId", "position");

CREATE UNIQUE INDEX "CustomFieldScope_fieldId_typeId_key" ON "CustomFieldScope"("fieldId", "typeId");

CREATE UNIQUE INDEX "CustomFieldValue_fieldId_itemId_key" ON "CustomFieldValue"("fieldId", "itemId");
CREATE INDEX "CustomFieldValue_itemId_idx" ON "CustomFieldValue"("itemId");

CREATE UNIQUE INDEX "WorkItemTag_itemId_tagId_key" ON "WorkItemTag"("itemId", "tagId");
CREATE INDEX "WorkItemTag_tagId_idx" ON "WorkItemTag"("tagId");

CREATE INDEX "Item_workspaceId_typeId_idx" ON "Item"("workspaceId", "typeId");
CREATE INDEX "Item_workspaceId_stateId_idx" ON "Item"("workspaceId", "stateId");
CREATE INDEX "Item_workspaceId_boardColumnId_idx" ON "Item"("workspaceId", "boardColumnId");
CREATE INDEX "Item_workspaceId_assigneeId_idx" ON "Item"("workspaceId", "assigneeId");
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");

CREATE INDEX "AutomationRule_workspaceId_enabled_idx" ON "AutomationRule"("workspaceId", "enabled");

-- AddForeignKey
ALTER TABLE "Item"
ADD CONSTRAINT "Item_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_boardColumnId_fkey" FOREIGN KEY ("boardColumnId") REFERENCES "BoardColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WorkItemType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "WorkflowState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Item"
ADD CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkItemType"
ADD CONSTRAINT "WorkItemType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowState"
ADD CONSTRAINT "WorkflowState_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardColumn"
ADD CONSTRAINT "BoardColumn_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ColumnStateMapping"
ADD CONSTRAINT "ColumnStateMapping_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ColumnStateMapping"
ADD CONSTRAINT "ColumnStateMapping_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ColumnStateMapping"
ADD CONSTRAINT "ColumnStateMapping_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "WorkflowState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TagDefinition"
ADD CONSTRAINT "TagDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspacePreferences"
ADD CONSTRAINT "WorkspacePreferences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldDefinition"
ADD CONSTRAINT "CustomFieldDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldOption"
ADD CONSTRAINT "CustomFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldScope"
ADD CONSTRAINT "CustomFieldScope_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldScope"
ADD CONSTRAINT "CustomFieldScope_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "WorkItemType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue"
ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue"
ADD CONSTRAINT "CustomFieldValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue"
ADD CONSTRAINT "CustomFieldValue_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkItemTag"
ADD CONSTRAINT "WorkItemTag_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItemTag"
ADD CONSTRAINT "WorkItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TagDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRule"
ADD CONSTRAINT "AutomationRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
