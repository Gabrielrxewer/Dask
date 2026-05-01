import { useState, useEffect } from 'react';
import type { JourneyNode, JourneyNodeData, TriggerConfig, ActionConfig, ConditionConfig, DelayConfig, ExitConfig } from '../types';
import { TRIGGER_EVENT_LABELS, ACTION_TYPE_LABELS, validateNode } from '../types';
import './panels.css';

interface NodeInspectorProps {
  node: JourneyNode;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<JourneyNodeData>) => void;
  onDelete: (id: string) => void;
}

const OPERATORS = ['eq', 'neq', 'gte', 'lte', 'contains', 'in', 'is_true', 'is_false'] as const;
const DELAY_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const;

export function NodeInspector({ node, onClose, onUpdate, onDelete }: NodeInspectorProps) {
  const [label, setLabel] = useState(node.data.label);
  const [config, setConfig] = useState(node.data.config);

  useEffect(() => {
    setLabel(node.data.label);
    setConfig(node.data.config);
  }, [node.id]);

  function save() {
    const newData: JourneyNodeData = {
      ...node.data,
      label,
      config,
      validation: validateNode({ ...node.data, label, config }),
    };
    onUpdate(node.id, newData);
  }

  function updateConfig(patch: Record<string, unknown>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  const { kind } = node.data;
  const validation = validateNode({ ...node.data, label, config });

  return (
    <div className="jb-inspector nodrag nopan">
      <div className="jb-inspector__head">
        <div className="jb-inspector__title">{label || 'Sem nome'}</div>
        <button type="button" className="jb-inspector__close" onClick={onClose} title="Fechar">
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="jb-inspector__body">
        {/* Validation status */}
        <div className={`jb-inspector__validation jb-inspector__validation--${validation}`}>
          {validation === 'valid' ? (
            <>
              <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
                <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bloco configurado
            </>
          ) : (
            <>
              <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              Configuração incompleta
            </>
          )}
        </div>

        {/* Label */}
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">Nome do bloco</label>
          <input
            className="jb-inspector__input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Enviar boas-vindas"
          />
        </div>

        <div className="jb-inspector__divider" />

        {/* TRIGGER config */}
        {kind === 'TRIGGER' && (
          <TriggerInspector config={config as TriggerConfig} onChange={updateConfig} />
        )}

        {/* ACTION config */}
        {kind === 'ACTION' && (
          <ActionInspector config={config as ActionConfig} onChange={updateConfig} />
        )}

        {/* CONDITION config */}
        {kind === 'CONDITION' && (
          <ConditionInspector config={config as ConditionConfig} onChange={updateConfig} />
        )}

        {/* DELAY config */}
        {kind === 'DELAY' && (
          <DelayInspector config={config as DelayConfig} onChange={updateConfig} />
        )}

        {/* EXIT config */}
        {kind === 'EXIT' && (
          <ExitInspector config={config as ExitConfig} onChange={updateConfig} />
        )}
      </div>

      <div className="jb-inspector__foot">
        <button type="button" className="jb-inspector__save-btn" onClick={save}>
          Salvar
        </button>
        <button
          type="button"
          className="jb-inspector__del-btn"
          onClick={() => onDelete(node.id)}
          title="Remover bloco"
        >
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M2 3.5h10M5.5 3.5V2h3v1.5M6 6v4.5M8 6v4.5M3.5 3.5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Sub-inspectors per kind ──────────────────────────────────── */

function TriggerInspector({ config, onChange }: { config: TriggerConfig; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div className="jb-inspector__section">
      <label className="jb-inspector__label">Evento gatilho</label>
      <select
        className="jb-inspector__select"
        value={config.event}
        onChange={(e) => onChange({ event: e.target.value })}
      >
        {(Object.entries(TRIGGER_EVENT_LABELS) as [string, string][]).map(([val, lbl]) => (
          <option key={val} value={val}>{lbl}</option>
        ))}
      </select>
    </div>
  );
}

function ActionInspector({ config, onChange }: { config: ActionConfig; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <>
      <div className="jb-inspector__section">
        <label className="jb-inspector__label">Tipo de ação</label>
        <select
          className="jb-inspector__select"
          value={config.type}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {(Object.entries(ACTION_TYPE_LABELS) as [string, string][]).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>

      {config.type === 'update_score' && (
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">Variação do score</label>
          <input
            className="jb-inspector__input"
            type="number"
            value={config.scoreChange ?? 0}
            onChange={(e) => onChange({ scoreChange: Number(e.target.value) })}
            placeholder="Ex: +10 ou -5"
          />
        </div>
      )}

      {config.type === 'move_lead' && (
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">Status de destino</label>
          <input
            className="jb-inspector__input"
            value={config.targetStatus ?? ''}
            onChange={(e) => onChange({ targetStatus: e.target.value })}
            placeholder="Ex: MQL, SQL, CLIENTE"
          />
        </div>
      )}

      {config.type === 'create_task' && (
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">Título da tarefa</label>
          <input
            className="jb-inspector__input"
            value={config.taskTitle ?? ''}
            onChange={(e) => onChange({ taskTitle: e.target.value })}
            placeholder="Ex: Follow-up comercial"
          />
        </div>
      )}

      {config.type === 'tag_lead' && (
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">Tag</label>
          <input
            className="jb-inspector__input"
            value={config.tag ?? ''}
            onChange={(e) => onChange({ tag: e.target.value })}
            placeholder="Ex: nurture-q1"
          />
        </div>
      )}

      {config.type === 'webhook' && (
        <div className="jb-inspector__section">
          <label className="jb-inspector__label">URL do webhook</label>
          <input
            className="jb-inspector__input"
            value={config.webhookUrl ?? ''}
            onChange={(e) => onChange({ webhookUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      )}
    </>
  );
}

function ConditionInspector({ config, onChange }: { config: ConditionConfig; onChange: (p: Record<string, unknown>) => void }) {
  const rules = config.rules ?? [];

  function updateRule(idx: number, patch: Partial<ConditionConfig['rules'][0]>) {
    const updated = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ rules: updated });
  }

  function addRule() {
    onChange({ rules: [...rules, { field: 'score', operator: 'gte', value: 0 }] });
  }

  function deleteRule(idx: number) {
    onChange({ rules: rules.filter((_, i) => i !== idx) });
  }

  return (
    <>
      <div className="jb-inspector__section">
        <label className="jb-inspector__label">Lógica</label>
        <select
          className="jb-inspector__select"
          value={config.logic}
          onChange={(e) => onChange({ logic: e.target.value })}
        >
          <option value="AND">E (AND) — todas as regras</option>
          <option value="OR">OU (OR) — qualquer regra</option>
        </select>
      </div>

      <div className="jb-inspector__section">
        <label className="jb-inspector__label">Regras</label>
        {rules.map((rule, idx) => (
          <div key={idx} style={{ display: 'grid', gap: 4 }}>
            <div className="jb-inspector__rule-row">
              <input
                className="jb-inspector__input"
                value={rule.field}
                onChange={(e) => updateRule(idx, { field: e.target.value })}
                placeholder="campo"
              />
              <select
                className="jb-inspector__select"
                value={rule.operator}
                onChange={(e) => updateRule(idx, { operator: e.target.value as typeof OPERATORS[number] })}
                style={{ minWidth: 80 }}
              >
                {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <button type="button" className="jb-inspector__rule-del" onClick={() => deleteRule(idx)}>
                <svg viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {!['is_true', 'is_false'].includes(rule.operator) && (
              <input
                className="jb-inspector__input"
                value={String(rule.value ?? '')}
                onChange={(e) => updateRule(idx, { value: e.target.value })}
                placeholder="valor"
              />
            )}
          </div>
        ))}
        <button type="button" className="jb-inspector__add-rule" onClick={addRule}>
          <svg viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Adicionar regra
        </button>
      </div>

      <div className="jb-inspector__section">
        <label className="jb-inspector__label">Rótulo do caminho SIM</label>
        <input
          className="jb-inspector__input"
          value={config.yesLabel ?? 'Sim'}
          onChange={(e) => onChange({ yesLabel: e.target.value })}
        />
      </div>
      <div className="jb-inspector__section">
        <label className="jb-inspector__label">Rótulo do caminho NÃO</label>
        <input
          className="jb-inspector__input"
          value={config.noLabel ?? 'Não'}
          onChange={(e) => onChange({ noLabel: e.target.value })}
        />
      </div>
    </>
  );
}

function DelayInspector({ config, onChange }: { config: DelayConfig; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div className="jb-inspector__section">
      <label className="jb-inspector__label">Duração</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input
          className="jb-inspector__input"
          type="number"
          min={1}
          value={config.duration}
          onChange={(e) => onChange({ duration: Number(e.target.value) })}
        />
        <select
          className="jb-inspector__select"
          value={config.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
        >
          {DELAY_UNITS.map((u) => (
            <option key={u} value={u}>
              {u === 'minutes' ? 'Minutos' : u === 'hours' ? 'Horas' : u === 'days' ? 'Dias' : 'Semanas'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ExitInspector({ config, onChange }: { config: ExitConfig; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div className="jb-inspector__section">
      <label className="jb-inspector__label">Motivo (opcional)</label>
      <input
        className="jb-inspector__input"
        value={config.reason ?? ''}
        onChange={(e) => onChange({ reason: e.target.value })}
        placeholder="Ex: Lead convertido"
      />
    </div>
  );
}
