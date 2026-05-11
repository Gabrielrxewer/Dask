import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildTaskInputFromFieldDrafts,
  buildTaskTypeMetaMap,
  createTaskFieldDrafts,
  getTaskTypeDisplayMeta,
  isTaskFieldValueEmpty,
  matchesTaskFieldStorage,
  readTaskFieldStorage,
  resolveWorkItemFieldBindingsForContext
} from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskFieldDefinition,
  TaskPriority,
  TaskStatus,
  TaskStatusId
} from "@/entities/task";
import type { Member, MembersById } from "@/entities/member";
import type {
  AiAgentSummary,
  CreateTaskInput,
  Customer,
  CustomerAddress,
  DocumentKind,
  TaskScheduleInput,
  UpdateTaskInput,
  WorkItemLinkedDocument,
  WorkspaceDocument
} from "@/modules/workspace/model";
import {
  normalizeTaskFieldPresentationValue,
  validateTaskFieldPresentationValue
} from "@/entities/task/ui/field-presentation";
import {
  WorkItemDynamicForm,
  WorkItemFormProvider,
  useWorkItemForm,
  type WorkItemFormValues
} from "@/entities/work-item-form";
import { legacyFieldBindingsToPublicSchema, type WorkItemPublicField, type WorkItemPublicSchema } from "@/entities/work-item-schema";
import { cn } from "@/shared/lib/cn";
import { AppDialog, Button, toast } from "@/shared/ui";
import "./task-details-modal.css";

type TaskDetailsModalProps =
  | {
      mode: "create";
      statuses: TaskStatus[];
      initialStatusId: TaskStatusId;
      initialTypeId: string;
      membersById: MembersById;
      boardConfig: BoardConfig;
      onCreateTask: (input: CreateTaskInput) => Promise<void> | void;
      onClose: () => void;
      availableTags?: Array<{ id: string; name: string; color: string }>;
    }
  | {
      mode: "edit";
      task: Task;
      status: TaskStatus;
      statuses: TaskStatus[];
      assignee: Member;
      membersById: MembersById;
      availableTags?: Array<{ id: string; name: string; color: string }>;
      creatorName?: string;
      boardConfig: BoardConfig;
      onSaveTask: (taskId: string, input: UpdateTaskInput) => Promise<void> | void;
      onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
      onUpdateStatus: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
      onUpdateTitle: (taskId: string, title: string) => Promise<void> | void;
      onUpdateDescription: (taskId: string, description: string) => Promise<void> | void;
      onUpdateCustomField: (taskId: string, fieldId: string, value: TaskCustomFieldValue) => Promise<void> | void;
      onUpdateSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void> | void;
      aiAgents: AiAgentSummary[];
      onRunAiAgentOnItem: (
        itemId: string,
        agentId: string,
        input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
      ) => Promise<{ runId: string; content: string }>;
      onRunAiRiskAnalysis: (
        itemId: string,
        input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
      ) => Promise<{ runId: string; content: string }>;
      listWorkspaceDocuments: () => Promise<WorkspaceDocument[]>;
      createWorkspaceDocument?: (input: {
        title: string;
        content?: string;
        kind?: DocumentKind;
        linkedEntityType?: "work_item" | "customer" | "proposal" | "contract";
        linkedEntityId?: string;
        tags?: string[];
        metadata?: WorkspaceDocument["metadata"];
        position?: number;
      }) => Promise<WorkspaceDocument>;
      listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
      linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
      unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
      onOpenDocument?: (documentId: string, taskId: string) => void;
      listCustomers?: (input?: { search?: string }) => Promise<Customer[]>;
      onClose: () => void;
    };

function toJsonComparable(value: unknown) {
  return JSON.stringify(value ?? null);
}

const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  wiki: "Wiki",
  proposal: "Proposta",
  contract: "Contrato"
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  viewed: "Visualizado",
  approved: "Aprovado",
  rejected: "Recusado",
  expired: "Expirado",
  accepted: "Aceito",
  signed: "Assinado",
  cancelled: "Cancelado"
};

function formatDocumentDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function applyCreateFieldDraftDefaults(
  drafts: Record<string, TaskCustomFieldValue>,
  fields: TaskFieldDefinition[],
  input: { initialStatusId: TaskStatusId; selectedTypeId: string }
) {
  const next = { ...drafts };

  for (const field of fields) {
    const storage = readTaskFieldStorage(field);
    const kind = typeof storage?.kind === "string" ? storage.kind : "";
    const property = typeof storage?.property === "string" ? storage.property : "";

    if (kind !== "item_property" || !isTaskFieldValueEmpty(field, next[field.id] ?? null)) {
      continue;
    }

    if (property === "stateSlug") {
      next[field.id] = input.initialStatusId;
    }

    if (property === "typeSlug") {
      next[field.id] = input.selectedTypeId;
    }
  }

  return next;
}

export function createTaskDetailsInitialFieldDrafts(input: {
  task: Task | null | undefined;
  fields: TaskFieldDefinition[];
  isCreateMode: boolean;
  initialStatusId: TaskStatusId;
  selectedTypeId: string;
  currentDrafts?: Record<string, TaskCustomFieldValue>;
}): Record<string, TaskCustomFieldValue> {
  const seeded = createTaskFieldDrafts(input.task, input.fields);
  const nextSeeded = input.isCreateMode
    ? applyCreateFieldDraftDefaults(seeded, input.fields, {
        initialStatusId: input.initialStatusId,
        selectedTypeId: input.selectedTypeId
      })
    : seeded;

  if (input.isCreateMode && input.currentDrafts) {
    for (const field of input.fields) {
      if (field.id in input.currentDrafts) {
        nextSeeded[field.id] = input.currentDrafts[field.id];
      }
    }
  }

  return nextSeeded;
}

function formatCustomerAddress(address: CustomerAddress | null | undefined): string {
  if (!address) {
    return "";
  }

  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(" / "),
    address.zipCode,
    address.country
  ]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" - ");
}

function getTaskFieldFormKey(field: TaskFieldDefinition): string {
  return field.variableKey ?? field.slug ?? field.id;
}

export function buildTaskDetailsOfficialFormValues(
  fields: TaskFieldDefinition[],
  drafts: Record<string, TaskCustomFieldValue>
): WorkItemFormValues {
  return fields.reduce<WorkItemFormValues>((acc, field) => {
    acc[getTaskFieldFormKey(field)] = normalizeTaskFieldPresentationValue(field, drafts[field.id] ?? null) ?? null;
    return acc;
  }, {});
}

export function mergeTaskDetailsFieldDraft(
  current: Record<string, TaskCustomFieldValue>,
  field: TaskFieldDefinition,
  value: TaskCustomFieldValue
): Record<string, TaskCustomFieldValue> {
  return {
    ...current,
    [field.id]: value
  };
}

function toPublicOptions(options: Array<{ id?: string; label: string; value: string; color?: string | null }>) {
  return options.map((option) => ({
    id: option.id ?? option.value,
    label: option.label,
    value: option.value,
    color: option.color ?? null
  }));
}

function withOperationalFormOptions(
  schema: WorkItemPublicSchema,
  input: {
    legacyFields: TaskFieldDefinition[];
    statuses: TaskStatus[];
    boardConfig: BoardConfig;
    membersById: MembersById;
  }
): WorkItemPublicSchema {
  const legacyFieldsByKey = new Map(input.legacyFields.map((field) => [getTaskFieldFormKey(field), field]));
  const memberOptions = toPublicOptions(
    Object.values(input.membersById)
      .filter((member) => member.id && member.name)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((member) => ({ id: member.id, value: member.id, label: member.name }))
  );
  const statusOptions = toPublicOptions(input.statuses.map((status) => ({
    id: status.id,
    value: status.id,
    label: status.label,
    color: status.dot
  })));
  const typeOptions = toPublicOptions(input.boardConfig.taskTypes.map((type) => ({
    id: type.id,
    value: type.id,
    label: type.label,
    color: type.text
  })));

  return {
    ...schema,
    fields: schema.fields.map((field) => {
      const legacyField = legacyFieldsByKey.get(field.key);
      const storage = legacyField ? readTaskFieldStorage(legacyField) : null;
      const property = typeof storage?.property === "string" ? storage.property : "";

      if (property === "stateSlug") {
        return { ...field, type: "select", options: statusOptions };
      }
      if (property === "typeSlug") {
        return { ...field, type: "select", options: typeOptions };
      }
      if (property === "assigneeId") {
        return { ...field, type: "user", options: memberOptions };
      }
      if (property === "dueDate") {
        return { ...field, type: "date" };
      }
      if (property === "description") {
        return { ...field, type: "textarea" };
      }

      return field;
    })
  };
}

function resolveOfficialFields(
  schema: WorkItemPublicSchema,
  fields: TaskFieldDefinition[]
): WorkItemPublicField[] {
  return fields
    .map((field) => {
      const key = getTaskFieldFormKey(field);
      return schema.fields.find((candidate) =>
        candidate.key === key ||
        candidate.id === field.id ||
        candidate.id === field.definitionId
      );
    })
    .filter((field): field is WorkItemPublicField => Boolean(field));
}

function getCreateDraftStorageKey(typeId: string): string {
  return `dask:work-item-form:draft:${typeId}`;
}

function readCreateDraft(storageKey: string): Record<string, TaskCustomFieldValue> | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) {
      return null;
    }
    const parsed = JSON.parse(rawDraft);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, TaskCustomFieldValue>
      : null;
  } catch {
    return null;
  }
}

function writeCreateDraft(storageKey: string, drafts: Record<string, TaskCustomFieldValue>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(drafts));
  } catch {
    // Draft storage is best effort; form submit remains the source of truth.
  }
}

function clearCreateDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Best effort cleanup.
  }
}

export function TaskDetailsModal(props: TaskDetailsModalProps) {
  const isCreateMode = props.mode === "create";
  const task = props.mode === "edit" ? props.task : null;
  const initialCreateStatusId = props.mode === "create" ? props.initialStatusId : "";
  const statuses = props.statuses;
  const boardConfig = props.boardConfig;
  const availableTags = props.availableTags ?? [];
  const listWorkspaceDocuments = props.mode === "edit" ? props.listWorkspaceDocuments : null;
  const listWorkItemLinkedDocuments = props.mode === "edit" ? props.listWorkItemLinkedDocuments : null;
  const unlinkDocumentFromWorkItem = props.mode === "edit" ? props.unlinkDocumentFromWorkItem : null;
  const openDocument = props.mode === "edit" ? props.onOpenDocument : undefined;
  const listCustomers = props.mode === "edit" ? (props.listCustomers ?? null) : null;
  const onClose = props.onClose;

  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);
  const initialTypeId = task?.type ?? (props.mode === "create" ? props.initialTypeId : boardConfig.taskTypes[0]?.id ?? "task");
  const [selectedTypeId, setSelectedTypeId] = useState(initialTypeId);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, TaskCustomFieldValue>>({});
  const fieldDraftsRef = useRef<Record<string, TaskCustomFieldValue>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [workspaceDocuments, setWorkspaceDocuments] = useState<WorkspaceDocument[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<WorkItemLinkedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  const detailBindings = useMemo(
    () =>
      resolveWorkItemFieldBindingsForContext(
        boardConfig,
        selectedTypeId,
        isCreateMode ? "form" : "detail"
      ),
    [boardConfig, isCreateMode, selectedTypeId]
  );

  const orderedVisibleFields = useMemo(
    () =>
      detailBindings
        .map(binding => binding.field)
        .filter(field => {
          if (field.config?.formVisible === false) {
            return false;
          }

          if (!isCreateMode) {
            return true;
          }

          return !(field.type === "work_item_type" || matchesTaskFieldStorage(field, { kind: "item_property", property: "typeSlug" }));
        }),
    [detailBindings, isCreateMode]
  );

  const officialFormSchema = useMemo(
    () => {
      const schema = legacyFieldBindingsToPublicSchema({
        schemaId: selectedTypeId,
        workspaceId: "workspace",
        name: getTaskTypeDisplayMeta(typeMap, selectedTypeId)?.label ?? selectedTypeId,
        boardConfig,
        fieldDefinitions: orderedVisibleFields,
        fieldBindings: detailBindings.map((binding, index) => ({
          id: binding.bindingId ?? `${selectedTypeId}:detail:${binding.field.id}:${index}`,
          fieldId: binding.field.id,
          typeId: selectedTypeId,
          displayContext: "detail",
          order: binding.order,
          section: binding.section,
          isVisible: binding.visible,
          isRequiredOverride: binding.required,
          isReadonlyOverride: binding.readonly,
          settings: binding.settings
        })),
        workflowStateIds: statuses.map((status) => status.id)
      });

      return withOperationalFormOptions(schema, {
        legacyFields: orderedVisibleFields,
        statuses,
        boardConfig,
        membersById: props.membersById
      });
    },
    [boardConfig, detailBindings, orderedVisibleFields, props.membersById, selectedTypeId, statuses, typeMap]
  );
  const officialForm = useWorkItemForm(officialFormSchema, task);
  const {
    reset: resetOfficialForm,
    setValue: setOfficialFormValue,
    trigger: triggerOfficialForm
  } = officialForm;

  const initialFieldDrafts = useMemo(
    () => createTaskDetailsInitialFieldDrafts({
      task,
      fields: orderedVisibleFields,
      isCreateMode,
      initialStatusId: initialCreateStatusId,
      selectedTypeId
    }),
    [initialCreateStatusId, isCreateMode, orderedVisibleFields, selectedTypeId, task]
  );

  const formFieldIdentityKey = useMemo(
    () =>
      orderedVisibleFields
        .map((field) => `${field.id}:${field.definitionId ?? ""}:${getTaskFieldFormKey(field)}:${field.type}`)
        .join("|"),
    [orderedVisibleFields]
  );
  const formDraftResetKey = `${props.mode}:${task?.id ?? "new"}:${initialCreateStatusId}:${selectedTypeId}:${formFieldIdentityKey}`;
  const lastFormDraftResetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedTypeId(initialTypeId);
  }, [initialTypeId]);

  useEffect(() => {
    if (lastFormDraftResetKeyRef.current === formDraftResetKey) {
      return;
    }

    const nextDrafts = createTaskDetailsInitialFieldDrafts({
      task,
      fields: orderedVisibleFields,
      isCreateMode,
      initialStatusId: initialCreateStatusId,
      selectedTypeId,
      currentDrafts: fieldDraftsRef.current
    });

    fieldDraftsRef.current = nextDrafts;
    setFieldDrafts(nextDrafts);
    resetOfficialForm(buildTaskDetailsOfficialFormValues(orderedVisibleFields, nextDrafts));
    lastFormDraftResetKeyRef.current = formDraftResetKey;
  }, [
    formDraftResetKey,
    initialCreateStatusId,
    isCreateMode,
    orderedVisibleFields,
    resetOfficialForm,
    selectedTypeId,
    task
  ]);

  useEffect(() => {
    fieldDraftsRef.current = fieldDrafts;
  }, [fieldDrafts]);

  useEffect(() => {
    setError("");
  }, [selectedTypeId, task?.id]);

  useEffect(() => {
    if (!task || !listWorkspaceDocuments || !listWorkItemLinkedDocuments) {
      setWorkspaceDocuments([]);
      setLinkedDocuments([]);
      return;
    }

    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError("");

    void Promise.all([
      listWorkspaceDocuments(),
      listWorkItemLinkedDocuments(task.id)
    ])
      .then(([nextWorkspaceDocuments, nextLinkedDocuments]) => {
        if (cancelled) {
          return;
        }

        setWorkspaceDocuments(nextWorkspaceDocuments);
        setLinkedDocuments(nextLinkedDocuments);
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentsError("Nao foi possivel carregar documentos vinculados.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listWorkspaceDocuments, listWorkItemLinkedDocuments, task]);

  const customerSelectorField = useMemo(
    () => boardConfig.fieldDefinitions.find(f => f.config?.entityType === "customer") ?? null,
    [boardConfig.fieldDefinitions]
  );

  const hasCustomerSelector = !!customerSelectorField && !!listCustomers;

  useEffect(() => {
    if (!listCustomers || !customerDropdownOpen) {
      return;
    }

    let cancelled = false;
    setCustomerLoading(true);

    void listCustomers({ search: customerSearch || undefined })
      .then((results) => {
        if (!cancelled) {
          setCustomerResults(results);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCustomerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listCustomers, customerSearch, customerDropdownOpen]);

  const applyCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDropdownOpen(false);
    setCustomerSearch(customer.name);

    const next = { ...fieldDraftsRef.current };
    const updatedFields: TaskFieldDefinition[] = [];
    const fieldMap = boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>(
      (acc, f) => { acc[f.slug ?? f.id] = f; return acc; },
      {}
    );

    const set = (slug: string, value: string) => {
      const field = fieldMap[slug];
      if (field) {
        next[field.id] = value;
        updatedFields.push(field);
      }
    };

    if (customerSelectorField) {
      next[customerSelectorField.id] = customer.id;
      updatedFields.push(customerSelectorField);
    }
    set("clientName", customer.name);
    set("companyName", customer.tradeName ?? customer.legalName ?? customer.name);
    set("clientLegalName", customer.legalName ?? customer.tradeName ?? customer.name);
    set("clientLogoUrl", customer.logoUrl ?? "");
    set("contactEmail", customer.email ?? "");
    set("contactPhone", customer.phone ?? "");
    set("clientDocument", customer.document ?? "");
    set("clientAddress", formatCustomerAddress(customer.address));

    fieldDraftsRef.current = next;
    setFieldDrafts(next);
    for (const field of updatedFields) {
      setOfficialFormValue(getTaskFieldFormKey(field), next[field.id] ?? null, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }, [boardConfig.fieldDefinitions, customerSelectorField, setOfficialFormValue]);

  const mainColumnFields = useMemo(
    () =>
      detailBindings
        .filter(binding => binding.zone === "main")
        .map(binding => binding.field)
        .filter(field => orderedVisibleFields.some(visibleField => visibleField.id === field.id)),
    [detailBindings, orderedVisibleFields]
  );

  const sideColumnFields = useMemo(
    () =>
      detailBindings
        .filter(binding => binding.zone === "side")
        .map(binding => binding.field)
        .filter(field => orderedVisibleFields.some(visibleField => visibleField.id === field.id))
        .filter(field => hasCustomerSelector ? field.config?.entityType !== "customer" : true),
    [detailBindings, orderedVisibleFields, hasCustomerSelector]
  );

  const officialMainFields = useMemo(
    () => resolveOfficialFields(officialFormSchema, mainColumnFields),
    [officialFormSchema, mainColumnFields]
  );

  const officialSideFields = useMemo(
    () => resolveOfficialFields(officialFormSchema, sideColumnFields),
    [officialFormSchema, sideColumnFields]
  );

  const workspaceDocumentsById = useMemo(
    () => new Map(workspaceDocuments.map((document) => [document.id, document])),
    [workspaceDocuments]
  );

  const documentRows = useMemo(() => {
    const source = linkedDocuments.length > 0 ? linkedDocuments : task?.linkedDocuments ?? [];
    return source.map((link) => {
      const document = workspaceDocumentsById.get(link.id);
      return {
        ...link,
        kind: link.kind ?? document?.kind,
        status: link.status ?? (typeof document?.metadata.status === "string" ? document.metadata.status : undefined),
        createdAt: link.createdAt ?? document?.createdAt,
        updatedAt: link.updatedAt ?? document?.updatedAt
      };
    });
  }, [linkedDocuments, task?.linkedDocuments, workspaceDocumentsById]);

  const activeTypeMeta = getTaskTypeDisplayMeta(typeMap, selectedTypeId);
  const accentVars = {
    "--task-accent-background": activeTypeMeta.background,
    "--task-accent-border": activeTypeMeta.border,
    "--task-accent-text": activeTypeMeta.text
  } as CSSProperties;

  const normalizedCurrentDrafts = useMemo(
    () =>
      orderedVisibleFields.reduce<Record<string, TaskCustomFieldValue>>((acc, field) => {
        acc[field.id] = normalizeTaskFieldPresentationValue(field, fieldDrafts[field.id] ?? null);
        return acc;
      }, {}),
    [fieldDrafts, orderedVisibleFields]
  );

  const createDraftStorageKey = useMemo(
    () => getCreateDraftStorageKey(selectedTypeId),
    [selectedTypeId]
  );
  const createDraftLoadKey = `${createDraftStorageKey}:${formFieldIdentityKey}`;
  const lastCreateDraftLoadKeyRef = useRef<string | null>(null);

  const handleClose = useCallback(() => {
    if (isCreateMode) {
      clearCreateDraft(createDraftStorageKey);
    }
    onClose();
  }, [createDraftStorageKey, isCreateMode, onClose]);

  useEffect(() => {
    if (!isCreateMode) {
      return;
    }

    if (lastCreateDraftLoadKeyRef.current === createDraftLoadKey) {
      return;
    }
    lastCreateDraftLoadKeyRef.current = createDraftLoadKey;

    const savedDraft = readCreateDraft(createDraftStorageKey);
    if (!savedDraft) {
      return;
    }

    const nextDrafts = { ...fieldDraftsRef.current, ...savedDraft };
    fieldDraftsRef.current = nextDrafts;
    setFieldDrafts(nextDrafts);
    resetOfficialForm(buildTaskDetailsOfficialFormValues(orderedVisibleFields, nextDrafts));
  }, [createDraftLoadKey, createDraftStorageKey, isCreateMode, orderedVisibleFields, resetOfficialForm]);

  useEffect(() => {
    if (!isCreateMode || Object.keys(fieldDrafts).length === 0) {
      return;
    }

    writeCreateDraft(createDraftStorageKey, fieldDrafts);
  }, [createDraftStorageKey, fieldDrafts, isCreateMode]);

  const hasChanges = useMemo(() => {
    if (isCreateMode || !task) {
      return false;
    }

    return orderedVisibleFields.some(
      field => toJsonComparable(normalizedCurrentDrafts[field.id]) !== toJsonComparable(initialFieldDrafts[field.id])
    );
  }, [initialFieldDrafts, isCreateMode, normalizedCurrentDrafts, orderedVisibleFields, task]);

  const fieldErrorsById = useMemo(
    () =>
      orderedVisibleFields.reduce<Record<string, string>>((acc, field) => {
        const value = normalizedCurrentDrafts[field.id];

        if (field.required === true && isTaskFieldValueEmpty(field, value)) {
          acc[field.id] = `Preencha o campo "${field.label}".`;
          return acc;
        }

        const validationError = validateTaskFieldPresentationValue({
          field,
          value,
          boardConfig,
          statuses,
          membersById: props.membersById,
          availableTags,
          task
        });

        if (validationError) {
          acc[field.id] = validationError;
        }

        return acc;
      }, {}),
    [availableTags, boardConfig, normalizedCurrentDrafts, orderedVisibleFields, props.membersById, statuses, task]
  );

  const firstFieldError = useMemo(() => {
    const fieldWithError = orderedVisibleFields.find(field => typeof fieldErrorsById[field.id] === "string");
    return fieldWithError ? fieldErrorsById[fieldWithError.id] ?? "" : "";
  }, [fieldErrorsById, orderedVisibleFields]);

  const canSave = isCreateMode ? !saving && !firstFieldError : !saving && hasChanges && !firstFieldError;

  const updateFieldDraft = useCallback((field: TaskFieldDefinition, value: TaskCustomFieldValue) => {
    setFieldDrafts(current => {
      const next = mergeTaskDetailsFieldDraft(current, field, value);
      fieldDraftsRef.current = next;
      return next;
    });

    if (field.type === "work_item_type" && typeof value === "string" && value.trim().length > 0) {
      setSelectedTypeId(value);
    }
  }, []);

  const handleOfficialFieldChange = useCallback(
    (field: WorkItemPublicField, value: unknown) => {
      const legacyField = orderedVisibleFields.find((candidate) =>
        getTaskFieldFormKey(candidate) === field.key ||
        candidate.id === field.id ||
        candidate.definitionId === field.id
      );
      if (!legacyField) {
        return;
      }

      updateFieldDraft(legacyField, value as TaskCustomFieldValue);
    },
    [orderedVisibleFields, updateFieldDraft]
  );

  const handleUnlinkDocument = async (documentId: string) => {
    if (!task || !unlinkDocumentFromWorkItem) {
      return;
    }

    setDocumentsLoading(true);
    setDocumentsError("");

    try {
      await unlinkDocumentFromWorkItem(task.id, documentId);
      setLinkedDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch {
      setDocumentsError("Nao foi possivel remover o vinculo do documento.");
      toast.error("Nao foi possivel remover o vinculo do documento.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const officialFormValid = await triggerOfficialForm();
    if (!officialFormValid) {
      setError("Revise os campos obrigatorios antes de salvar.");
      return;
    }

    if (firstFieldError) {
      setError(firstFieldError);
      return;
    }

    const draftPayload = buildTaskInputFromFieldDrafts(orderedVisibleFields, normalizedCurrentDrafts);
    const nextTitle = typeof draftPayload.title === "string" ? draftPayload.title.trim() : "";
    if (nextTitle.length < 2) {
      setError("O titulo precisa ter ao menos 2 caracteres.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (isCreateMode) {
        const payload: CreateTaskInput = {
          type: typeof draftPayload.type === "string" && draftPayload.type.length > 0 ? draftPayload.type : selectedTypeId,
          title: nextTitle,
          description: typeof draftPayload.description === "string" ? draftPayload.description : "",
          priority: typeof draftPayload.priority === "number" ? (draftPayload.priority as TaskPriority) : 2,
          statusId: typeof draftPayload.statusId === "string" ? draftPayload.statusId : props.initialStatusId,
          assigneeId: draftPayload.assigneeId,
          dueDate: draftPayload.dueDate,
          tags: draftPayload.tags,
          checklist: draftPayload.checklist,
          fields: draftPayload.fields,
          customFieldValues: draftPayload.customFieldValues
        };

        await Promise.resolve(props.onCreateTask(payload));
        clearCreateDraft(createDraftStorageKey);
        toast.success("Item criado.");
        onClose();
        return;
      }

      if (!task) {
        return;
      }

      const currentPayload = buildTaskInputFromFieldDrafts(orderedVisibleFields, initialFieldDrafts);
      const nextPayload: UpdateTaskInput = {};

      if (nextTitle !== task.title) {
        nextPayload.title = nextTitle;
      }

      if (typeof draftPayload.description === "string" && draftPayload.description !== currentPayload.description) {
        nextPayload.description = draftPayload.description;
      }

      if (typeof draftPayload.typeSlug === "string" && draftPayload.typeSlug !== currentPayload.typeSlug) {
        nextPayload.typeSlug = draftPayload.typeSlug;
      }

      if (draftPayload.stateId !== currentPayload.stateId && typeof draftPayload.stateId === "string") {
        nextPayload.stateId = draftPayload.stateId;
      }

      if (draftPayload.assigneeId !== currentPayload.assigneeId) {
        nextPayload.assigneeId = (draftPayload.assigneeId as string | null | undefined) ?? null;
      }

      if (draftPayload.dueDate !== currentPayload.dueDate) {
        nextPayload.dueDate = (draftPayload.dueDate as string | null | undefined) ?? null;
      }

      if (toJsonComparable(draftPayload.tags) !== toJsonComparable(currentPayload.tags)) {
        nextPayload.tags = Array.isArray(draftPayload.tags) ? draftPayload.tags : [];
      }

      if (draftPayload.priority !== currentPayload.priority && typeof draftPayload.priority === "number") {
        nextPayload.priority = draftPayload.priority as TaskPriority;
      }

      if (toJsonComparable(draftPayload.checklist) !== toJsonComparable(currentPayload.checklist)) {
        nextPayload.checklist = draftPayload.checklist;
      }

      if (toJsonComparable(draftPayload.fields) !== toJsonComparable(currentPayload.fields)) {
        nextPayload.fields = (draftPayload.fields as Record<string, unknown> | undefined) ?? {};
      }

      if (toJsonComparable(draftPayload.customFieldValues) !== toJsonComparable(currentPayload.customFieldValues)) {
        nextPayload.customFieldValues = (draftPayload.customFieldValues as Record<string, unknown> | undefined) ?? {};
      }

      if (Object.keys(nextPayload).length === 0) {
        return;
      }

      await Promise.resolve(props.onSaveTask(task.id, nextPayload));
      toast.success("Alteracoes salvas.");
    } catch (error) {
      const message = isCreateMode ? "Nao foi possivel criar o item." : "Nao foi possivel salvar as alteracoes.";
      setError(message);
      toast.error(message, {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      className="task-details"
      bodyClassName="task-details__dialog-body"
      showClose={false}
    >
      <div className="task-details__surface" style={accentVars}>
        <header className="task-details__topbar">
          <div className="task-details__header-copy">
            <p className="task-details__breadcrumbs">{isCreateMode ? "Novo item" : "Work item"}</p>
            <h2 id="task-details-title">{isCreateMode ? "Criar work item" : "Editar work item"}</h2>
          </div>
          <button className="task-details__close" type="button" onClick={handleClose} aria-label="Fechar editor">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" width="16" height="16">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={`task-details__body ${isCreateMode ? "task-details__body--create" : "task-details__body--edit"}`}>
          <WorkItemFormProvider form={officialForm}>
          <section className="task-details__main">
            {officialMainFields.length > 0 ? (
              <WorkItemDynamicForm
                schema={officialFormSchema}
                fields={officialMainFields}
                className="task-details__official-form task-details__official-form--main"
                layoutZone="main"
                onFieldChange={handleOfficialFieldChange}
              />
            ) : (
              <section className="task-details__section">
                <div className="task-details__section-head">
                  <h3 className="task-details__summary-style-title">Sem campos principais</h3>
                </div>
                <p className="task-details__muted">Associe campos a este tipo de item para montar o formulario.</p>
              </section>
            )}
          </section>

          <aside className="task-details__side">
            {hasCustomerSelector ? (
              <section className="task-details__panel task-details__customer-selector">
                <label className="task-details__customer-label" htmlFor="customer-selector-input">
                  Cliente
                </label>
                <div className="task-details__customer-input-wrap">
                  <input
                    id="customer-selector-input"
                    ref={customerSearchRef}
                    className="task-details__customer-input"
                    type="text"
                    placeholder="Buscar cliente existente..."
                    value={customerSearch}
                    autoComplete="off"
                    onChange={e => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                  />
                  {selectedCustomer ? (
                    <button
                      type="button"
                      className="task-details__customer-clear"
                      aria-label="Remover cliente"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                        setCustomerDropdownOpen(false);
                        customerSearchRef.current?.focus();
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                  {customerDropdownOpen ? (
                    <ul className="task-details__customer-dropdown" role="listbox">
                      {customerLoading ? (
                        <li className="task-details__customer-option task-details__customer-option--loading">
                          Buscando...
                        </li>
                      ) : customerResults.length === 0 ? (
                        <li className="task-details__customer-option task-details__customer-option--empty">
                          Nenhum cliente encontrado
                        </li>
                      ) : (
                        customerResults.map(c => (
                          <li
                            key={c.id}
                            role="option"
                            aria-selected={selectedCustomer?.id === c.id}
                            className={cn(
                              "task-details__customer-option",
                              selectedCustomer?.id === c.id && "task-details__customer-option--selected"
                            )}
                            onMouseDown={() => applyCustomer(c)}
                          >
                            <span className="task-details__customer-name">{c.name}</span>
                            {c.tradeName && c.tradeName !== c.name ? (
                              <span className="task-details__customer-trade">{c.tradeName}</span>
                            ) : null}
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </div>
              </section>
            ) : null}
            {officialSideFields.length > 0 ? (
              <WorkItemDynamicForm
                schema={officialFormSchema}
                fields={officialSideFields}
                className="task-details__official-form task-details__official-form--side"
                layoutZone="side"
                onFieldChange={handleOfficialFieldChange}
              />
            ) : null}
            {!isCreateMode ? (
              <section className="task-details__panel task-details__documents">
                <h3 className="task-details__summary-style-title">Documentos</h3>
                {documentsError ? <p className="task-details__documents-error">{documentsError}</p> : null}
                {documentsLoading && documentRows.length === 0 ? <p className="task-details__muted">Carregando...</p> : null}
                {!documentsLoading && documentRows.length === 0 ? <p className="task-details__muted">Nenhum documento.</p> : null}
                {documentRows.length > 0 ? (
                  <div className="task-details__documents-list">
                    {documentRows.map((document) => {
                      const kindLabel = document.kind ? DOCUMENT_KIND_LABELS[document.kind] : "Documento";
                      const statusLabel =
                        typeof document.status === "string" && document.status.trim()
                          ? DOCUMENT_STATUS_LABELS[document.status] ?? document.status
                          : "-";

                      return (
                        <article
                          className="task-details__document-row"
                          key={document.id}
                          role={openDocument ? "button" : undefined}
                          tabIndex={openDocument ? 0 : undefined}
                          onClick={openDocument && task ? () => openDocument(document.id, task.id) : undefined}
                          onKeyDown={openDocument && task ? (e) => { if (e.key === "Enter" || e.key === " ") openDocument(document.id, task.id); } : undefined}
                        >
                          <div className="task-details__document-info">
                            <span className="task-details__document-kind">{kindLabel}</span>
                            <strong className="task-details__document-title">{document.title}</strong>
                            {document.status && document.status !== "draft" ? (
                              <span className="task-details__document-status" data-status={document.status}>{statusLabel}</span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="task-details__document-remove"
                            onClick={(e) => { e.stopPropagation(); void handleUnlinkDocument(document.id); }}
                            disabled={documentsLoading}
                            aria-label="Remover documento"
                          >
                            <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
                              <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 0 0 4.5 14h7a.5.5 0 0 0 .5-.5L13 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>
          </WorkItemFormProvider>
        </div>

        <footer className="task-details__actionbar">
          <div className="task-details__actionbar-copy">
            {error ? (
              <p className="task-details__error">{error}</p>
            ) : (
              <p>
                {isCreateMode
                  ? "Os campos exibidos aqui seguem o schema configurado para este tipo de work item."
                  : "A edicao usa o mesmo registry de tipos do card e das configuracoes do workspace."}
              </p>
            )}
          </div>
          <div className="task-details__actionbar-actions">
            <Button type="button" size="sm" variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!canSave}
            >
              {saving ? (isCreateMode ? "Criando..." : "Salvando...") : isCreateMode ? "Criar item" : "Salvar alteracoes"}
            </Button>
          </div>
        </footer>
      </div>
    </AppDialog>
  );
}
