import type {
  HomeBadge,
  HomeFeature,
  HomeFocusPanel,
  HomePreviewLane,
  HomeProcessStage,
  HomeSearchLens,
  HomeSignal,
  HomeStructureLayer,
  HomeUseCase
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

export const previewLanes: HomePreviewLane[] = [
  {
    title: "Entrada estruturada",
    description: "Itens recebem template, prioridade e contexto desde o inicio.",
    count: "18 ativos",
    tone: "blue",
    items: ["Novo onboarding enterprise", "Plano de aula intensivo", "Revisao de nao conformidade"]
  },
  {
    title: "Execucao assistida",
    description: "IA sugere proxima acao, ajustes de descricao e referencias relacionadas.",
    count: "07 em foco",
    tone: "violet",
    items: ["Refinar escopo com IA", "Cruzar dependencias de squads", "Ajustar checklist operacional"]
  },
  {
    title: "Evolucao continua",
    description: "Automacoes, busca e templates mantem o fluxo consistente.",
    count: "05 automacoes",
    tone: "teal",
    items: ["Atualizar base semantica", "Replicar template por unidade", "Gerar sinal de risco recorrente"]
  }
];

export const platformFeatures: HomeFeature[] = [
  {
    eyebrow: "IA no fluxo real",
    title: "A inteligencia participa do processo sem virar uma tela isolada.",
    description:
      "O Dask leva apoio de IA para o momento em que o trabalho acontece: entrada do item, enriquecimento de contexto, busca, priorizacao e proxima acao.",
    highlights: ["Aprimora descricao", "Sinaliza riscos", "Sugere proximos passos"]
  },
  {
    eyebrow: "Busca semantica",
    title: "Contexto acionavel em diferentes areas, tipos de conteudo e estruturas.",
    description:
      "A plataforma localiza informacao por significado em boards, historicos, templates e documentos relacionados, reduzindo perda de contexto operacional.",
    highlights: ["Itens e historico", "Templates e referencias", "Consultas multicontexto"]
  },
  {
    eyebrow: "Estrutura configuravel",
    title: "Workspaces, boards, campos, regras e templates sem comprometer a experiencia.",
    description:
      "O sistema pode nascer em software, mas foi pensado para acomodar diferentes modelos operacionais com clareza visual e governanca.",
    highlights: ["Boards sob medida", "Campos e estados customizados", "Templates replicaveis"]
  },
  {
    eyebrow: "Produto de ecossistema",
    title: "Mais que um board: uma entrada de sistema pronta para operacoes maduras.",
    description:
      "A Home comunica governanca, inteligencia e flexibilidade logo na primeira dobra, com preview de produto, arquitetura clara e presenca de marca.",
    highlights: ["Visao premium", "Leitura imediata", "Percepcao de robustez"]
  }
];

export const processStages: HomeProcessStage[] = [
  {
    step: "01",
    title: "Captura com padrao e contexto",
    description:
      "Templates organizam o que entra no fluxo e evitam que cada atividade comece do zero.",
    note: "Menos improviso na origem da operacao."
  },
  {
    step: "02",
    title: "IA contextualiza durante a execucao",
    description:
      "Descricoes, categorias e proxima acao podem ser refinadas com apoio inteligente no proprio percurso.",
    note: "Apoio continuo em vez de consulta eventual."
  },
  {
    step: "03",
    title: "Busca semantica reduz friccao",
    description:
      "Times acessam referencias, historicos e itens correlatos por significado, com menos dependencia de memoria individual.",
    note: "Decisao mais rapida com contexto recuperavel."
  },
  {
    step: "04",
    title: "Estrutura evolui com o negocio",
    description:
      "Boards, views, campos e automacoes se adaptam ao processo sem desmontar a experiencia do produto.",
    note: "Escala com consistencia visual e operacional."
  }
];

export const focusPanel: HomeFocusPanel = {
  eyebrow: "Painel de contexto",
  title: "IA age junto da atividade em vez de ficar isolada em um chat paralelo.",
  summary:
    "Ao abrir um item, o Dask combina status, historico, busca semantica e sinais do board para apoiar a proxima decisao.",
  status: "Descricao aprimorada + proxima acao sugerida",
  tags: ["Descricao", "Prioridade", "Busca", "Template"],
  metrics: [
    { label: "Fontes relacionadas", value: "12" },
    { label: "Sugestoes acionaveis", value: "04" },
    { label: "Tempo de leitura", value: "-38%" }
  ],
  insights: [
    "Padroniza a descricao conforme o template do fluxo.",
    "Relaciona itens semelhantes antes de criar retrabalho.",
    "Indica proximos passos coerentes com o estado atual."
  ]
};

export const searchLenses: HomeSearchLens[] = [
  {
    label: "Software",
    query: "quais itens de onboarding enterprise estao com risco alto",
    context: "Busca semantica entre backlog, historico, templates e dependencias relacionadas.",
    results: ["Board Growth: 6 itens com dependencia de API", "Template: rollout enterprise", "Documento: SLA de implantacao"]
  },
  {
    label: "Administrativo",
    query: "pendencias de aprovacao com atraso recorrente",
    context: "Recupera aprovacoes, responsaveis, regras e sinais de gargalo no fluxo.",
    results: ["Fila financeira: 9 aprovacoes acima do SLA", "Template: aprovacao multietapa", "Registro: historico de replanejamento"]
  },
  {
    label: "Qualidade",
    query: "nao conformidades recorrentes na linha 4",
    context: "Cruza ocorrencias, checklists, causas e padroes de recorrencia por significado.",
    results: ["Checklist de inspecao final", "Historico: 3 causas com recorrencia mensal", "Acao preventiva recomendada"]
  }
];

export const structureLayers: HomeStructureLayer[] = [
  {
    label: "Camada 01",
    title: "Workspace alinhado ao contexto da operacao",
    description: "Cada area pode iniciar com nomenclatura, vistas e sinais adequados ao proprio fluxo."
  },
  {
    label: "Camada 02",
    title: "Boards e views com leitura operacional",
    description: "Kanban, lista, timeline e outras vistas podem coexistir sem perder consistencia."
  },
  {
    label: "Camada 03",
    title: "Campos, estados e regras configuraveis",
    description: "A estrutura absorve variacoes de processo sem virar um produto quebrado ou confuso."
  },
  {
    label: "Camada 04",
    title: "Templates replicaveis e expansao controlada",
    description: "Boas praticas podem ser copiadas entre times, unidades e novos cenarios operacionais."
  }
];

export const useCases: HomeUseCase[] = [
  {
    title: "Software",
    description: "Discovery, backlog, entrega, QA e suporte conectados por contexto.",
    outcome: "Times trabalham com menos retrabalho e mais rastreabilidade."
  },
  {
    title: "Escola",
    description: "Matricula, acompanhamento academico, secretaria e comunicacao interna em fluxo unico.",
    outcome: "Jornada do aluno organizada com visibilidade institucional."
  },
  {
    title: "Administrativo",
    description: "Solicitacoes internas, aprovacoes, SLA e execucao operacional em uma mesma base.",
    outcome: "Processos claros sem depender de controles paralelos."
  },
  {
    title: "Qualidade e suporte",
    description: "Ocorrencias, nao conformidades, atendimento e planos de acao com memoria operacional.",
    outcome: "Resposta consistente, historico recuperavel e melhoria continua."
  }
];
