import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  buildNodeConfigZodSchema,
  NodeConfigForm,
  type NodeConfigComponentRegistry
} from "@/shared/flow-node-config";
import { AppForm, AppIcon, AppSelect, AppTextField, Button, TextInput } from "@/shared/ui";
import type { ConditionConfig, JourneyNode, JourneyNodeConfig, JourneyNodeData } from "../types";
import { validateNode } from "../types";
import {
  createMarketingJourneyNodeConfigDescriptor,
  marketingConditionOperatorOptions
} from "../node-config-descriptors";
import "./panels.css";

interface NodeInspectorProps {
  node: JourneyNode;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<JourneyNodeData>) => void;
  onDelete: (id: string) => void;
}

type ConditionRule = ConditionConfig["rules"][number];

const nodeInspectorMetaSchema = z.object({
  label: z.string().trim().min(1, "Informe um nome para o bloco.")
});

type NodeInspectorMetaInput = z.input<typeof nodeInspectorMetaSchema>;
type NodeInspectorMetaValues = z.output<typeof nodeInspectorMetaSchema>;

const componentRegistry: NodeConfigComponentRegistry = {
  "marketing-condition-rules": ({ value, onChange }) => (
    <ConditionRulesEditor value={readRules(value)} onChange={(rules) => onChange(rules)} />
  )
};

function readRules(value: unknown): ConditionRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ConditionRule => Boolean(entry) && typeof entry === "object");
}

export function NodeInspector({ node, onClose, onUpdate, onDelete }: NodeInspectorProps) {
  const [config, setConfig] = useState<JourneyNodeConfig>(node.data.config);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const metaFormId = `journey-node-meta-${node.id}`;
  const metaForm = useForm<NodeInspectorMetaInput, unknown, NodeInspectorMetaValues>({
    resolver: zodResolver(nodeInspectorMetaSchema),
    defaultValues: { label: node.data.label },
    mode: "onChange"
  });
  const label = metaForm.watch("label");

  useEffect(() => {
    metaForm.reset({ label: node.data.label });
    setConfig(node.data.config);
    setSubmitError(null);
  }, [metaForm, node.id, node.data.config, node.data.label]);

  const descriptor = useMemo(
    () => createMarketingJourneyNodeConfigDescriptor(node.data.kind, config),
    [config, node.data.kind]
  );
  const schema = useMemo(() => buildNodeConfigZodSchema(descriptor), [descriptor]);
  const configResult = schema.safeParse(config);
  const metaResult = nodeInspectorMetaSchema.safeParse({ label });
  const validation = configResult.success && metaResult.success
    ? validateNode({ ...node.data, label: metaResult.data.label, config })
    : "incomplete";
  const validationMessage = !metaResult.success
    ? metaResult.error.issues[0]?.message ?? "Informe um nome para o bloco."
    : configResult.success
    ? null
    : configResult.error.issues[0]?.message ?? "Configuracao incompleta";

  function save(values: NodeInspectorMetaValues) {
    const result = schema.safeParse(config);
    if (!result.success) {
      setSubmitError(result.error.issues[0]?.message ?? "Configuracao incompleta");
      return;
    }

    const newData: JourneyNodeData = {
      ...node.data,
      label: values.label,
      config,
      validation: validateNode({ ...node.data, label: values.label, config })
    };
    onUpdate(node.id, newData);
    setSubmitError(null);
  }

  return (
    <div className="jb-inspector nodrag nopan">
      <div className="jb-inspector__head">
        <div className="jb-inspector__title">{label?.trim() || "Sem nome"}</div>
        <Button type="button" className="jb-inspector__close" variant="ghost" size="icon" onClick={onClose} title="Fechar" aria-label="Fechar">
          <AppIcon name="x" size={13} />
        </Button>
      </div>

      <div className="jb-inspector__body">
        <div className={`jb-inspector__validation jb-inspector__validation--${validation}`}>
          {validation === "valid" ? (
            <>
              <AppIcon name="check" size={12} />
              Bloco configurado
            </>
          ) : (
            <>
              <AppIcon name="alert-circle" size={12} />
              Configuracao incompleta
            </>
          )}
        </div>
        {validationMessage ? <span className="jb-inspector__error">{validationMessage}</span> : null}

        <AppForm
          id={metaFormId}
          form={metaForm}
          className="jb-inspector__meta-form"
          onSubmit={save}
        >
          <AppTextField<NodeInspectorMetaInput, "label">
            name="label"
            label="Nome do bloco"
            className="jb-inspector__section"
            placeholder="Ex: Enviar boas-vindas"
          />
        </AppForm>

        <div className="jb-inspector__divider" />

        <NodeConfigForm
          descriptor={descriptor}
          value={config as Record<string, unknown>}
          onChange={(value) => {
            setConfig(value as JourneyNodeConfig);
            setSubmitError(null);
          }}
          componentRegistry={componentRegistry}
          submitLabel="Validar config"
        />
      </div>

      <div className="jb-inspector__foot">
        {submitError ? <span className="jb-inspector__error">{submitError}</span> : null}
        <Button type="submit" form={metaFormId} className="jb-inspector__save-btn" variant="primary" size="sm">
          Salvar
        </Button>
        <Button
          type="button"
          className="jb-inspector__del-btn"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(node.id)}
          title="Remover bloco"
          aria-label="Remover bloco"
        >
          <AppIcon name="trash" size={13} />
        </Button>
      </div>
    </div>
  );
}

function ConditionRulesEditor({
  value,
  onChange
}: {
  value: ConditionRule[];
  onChange: (value: ConditionRule[]) => void;
}) {
  function updateRule(index: number, patch: Partial<ConditionRule>) {
    onChange(value.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    onChange([...value, { field: "score", operator: "gte", value: 0 }]);
  }

  function deleteRule(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="jb-inspector__rules">
      {value.map((rule, index) => (
        <div key={index} className="jb-inspector__rule">
          <div className="jb-inspector__rule-row">
            <TextInput
              value={rule.field}
              onChange={(event) => updateRule(index, { field: event.target.value })}
              placeholder="campo"
            />
            <AppSelect
              value={rule.operator}
              onValueChange={(operator) => updateRule(index, { operator: operator as ConditionRule["operator"] })}
              aria-label="Operador"
              items={marketingConditionOperatorOptions}
            />
            <Button
              type="button"
              className="jb-inspector__rule-del"
              variant="ghost"
              size="icon"
              onClick={() => deleteRule(index)}
              aria-label="Remover regra"
            >
              <AppIcon name="x" size={11} />
            </Button>
          </div>
          {!["is_true", "is_false"].includes(rule.operator) ? (
            <TextInput
              value={String(rule.value ?? "")}
              onChange={(event) => updateRule(index, { value: event.target.value })}
              placeholder="valor"
            />
          ) : null}
        </div>
      ))}
      <Button type="button" className="jb-inspector__add-rule" variant="outline" size="sm" onClick={addRule}>
        <AppIcon name="plus" size={11} />
        Adicionar regra
      </Button>
    </div>
  );
}
