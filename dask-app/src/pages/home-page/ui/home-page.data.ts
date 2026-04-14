import type {
  HomeArchitectureItem,
  HomeBadge,
  HomeProcessStage,
  HomeSignal,
  HomeUseCase,
  HomeValuePillar
} from "./home-page.types";

export const heroBadges: HomeBadge[] = [
  { label: "IA continua" },
  { label: "Busca semantica", tone: "success" },
  { label: "Estrutura configuravel", tone: "warning" }
];

export const heroSignals: HomeSignal[] = [
  {
    label: "IA distribuida",
    value: "apoia da entrada a execucao",
    description: "Descricao, padrao, proxima acao e contexto deixam de depender de consultas soltas."
  },
  {
    label: "Busca com contexto",
    value: "encontra significado entre areas",
    description: "Recupere itens, templates, historico e referencias sem depender do nome exato."
  },
  {
    label: "Operacao flexivel",
    value: "boards, campos e templates adaptaveis",
    description: "A mesma base atende software, suporte, escola, administrativo, qualidade e mais."
  }
];

export const valuePillars: HomeValuePillar[] = [
  {
    eyebrow: "IA continua",
    title: "Inteligencia no ponto em que o trabalho acontece.",
    description: "Apoio para descrever, priorizar, contextualizar e sugerir proximos passos dentro do fluxo."
  },
  {
    eyebrow: "Busca semantica",
    title: "Contexto recuperavel por significado.",
    description: "Itens, historicos, templates e referencias aparecem pela intencao da busca, nao apenas pelo nome exato."
  },
  {
    eyebrow: "Estrutura configuravel",
    title: "Estrutura flexivel sem perder clareza.",
    description: "Workspaces, boards, campos, views, regras e templates se ajustam ao processo de cada operacao."
  }
];

export const processStages: HomeProcessStage[] = [
  {
    step: "01",
    title: "Entrada estruturada",
    description: "Templates e campos essenciais padronizam o que entra no fluxo."
  },
  {
    step: "02",
    title: "Enriquecimento com IA",
    description: "Descricoes, prioridades e sinais recebem contexto antes da execucao."
  },
  {
    step: "03",
    title: "Busca contextual",
    description: "Historico, itens relacionados e referencias ficam recuperaveis por significado."
  },
  {
    step: "04",
    title: "Execucao com contexto",
    description: "O time decide com mais clareza, menos retrabalho e melhor rastreabilidade."
  },
  {
    step: "05",
    title: "Evolucao continua",
    description: "Regras, views e templates amadurecem junto com a operacao."
  }
];

export const useCases: HomeUseCase[] = [
  {
    title: "Software",
    focus: "Discovery, backlog, entrega, QA e suporte conectados."
  },
  {
    title: "Administrativo",
    focus: "Solicitacoes, aprovacoes, SLAs e execucao interna."
  },
  {
    title: "Qualidade",
    focus: "Ocorrencias, nao conformidades e planos de acao."
  },
  {
    title: "Suporte",
    focus: "Atendimentos, historico, prioridade e melhoria continua."
  },
  {
    title: "Escola",
    focus: "Secretaria, acompanhamento academico e comunicacao interna."
  }
];

export const architectureItems: HomeArchitectureItem[] = [
  {
    label: "Workspaces",
    detail: "Separacao clara por area, cliente, unidade ou frente operacional."
  },
  {
    label: "Boards",
    detail: "Modelos de fluxo para organizar demanda, execucao e acompanhamento."
  },
  {
    label: "Campos",
    detail: "Informacoes essenciais adaptadas a cada tipo de operacao."
  },
  {
    label: "Views",
    detail: "Leitura por kanban, lista, timeline e perspectivas de gestao."
  },
  {
    label: "Regras",
    detail: "Automacoes e criterios que reduzem trabalho repetitivo."
  },
  {
    label: "Templates",
    detail: "Padroes replicaveis para escalar boas praticas com consistencia."
  }
];
