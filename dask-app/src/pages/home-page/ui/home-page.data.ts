import type {
  HomeArchitectureItem,
  HomeBadge,
  HomeProcessStage,
  HomeSignal,
  HomeUseCase,
  HomeValuePillar
} from "./home-page.types";

export const heroBadges: HomeBadge[] = [
  { label: "Do lead ao faturamento" },
  { label: "IA contextual", tone: "success" },
  { label: "Estrutura configuravel", tone: "warning" }
];

export const heroSignals: HomeSignal[] = [
  {
    label: "Continuidade operacional",
    value: "O mesmo contexto atravessa toda a jornada",
    description: "Lead, escopo, documentacao, execucao, agenda e cobranca deixam de viver em ferramentas separadas."
  },
  {
    label: "Menos retrabalho",
    value: "Pare de reescrever o mesmo trabalho",
    description: "O que foi vendido alimenta o escopo. O que foi documentado orienta a execucao. O que foi executado sustenta o faturamento."
  },
  {
    label: "IA ao longo do fluxo",
    value: "Inteligencia aplicada no contexto certo",
    description: "A IA apoia transicao, analise e decisao dentro da operacao, em vez de virar um assistente solto fora do processo."
  }
];

export const valuePillars: HomeValuePillar[] = [
  {
    eyebrow: "Fluxo continuo",
    title: "Do comercial a entrega no mesmo dado.",
    description: "O que entra como oportunidade evolui para escopo, documentacao, execucao e acompanhamento sem perder rastreabilidade."
  },
  {
    eyebrow: "Contexto preservado",
    title: "Da user story a cobranca, sem quebra de contexto.",
    description: "Cada etapa herda historico, decisao e referencia da etapa anterior, reduzindo ruido, retrabalho e desalinhamento."
  },
  {
    eyebrow: "IA aplicada",
    title: "Inteligencia dentro da operacao, nao ao lado dela.",
    description: "A IA ajuda a interpretar contexto, sugerir proximos passos e acelerar execucao ao longo da jornada inteira."
  }
];

export const processStages: HomeProcessStage[] = [
  {
    step: "01",
    title: "Lead e oportunidade",
    description: "Centralize origem, necessidade, escopo inicial e sinais comerciais em vez de espalhar informacao em CRM, chat e anotacoes."
  },
  {
    step: "02",
    title: "Escopo e documentacao",
    description: "Transforme contexto comercial em proposta, user stories, requisitos e referencias sem reiniciar o trabalho."
  },
  {
    step: "03",
    title: "Execucao conectada",
    description: "Boards, listas, timeline e agenda operam sobre o mesmo contexto que veio das etapas anteriores."
  },
  {
    step: "04",
    title: "Acompanhamento e previsibilidade",
    description: "Status, datas, dependencias e historico ficam visiveis para acompanhar entrega sem reconstruir a narrativa em cada reuniao."
  },
  {
    step: "05",
    title: "Cobranca e faturamento",
    description: "A operacao realizada alimenta cobranca, fiscal e faturamento com mais clareza, rastreabilidade e menos retrabalho."
  }
];

export const useCases: HomeUseCase[] = [
  {
    title: "Software houses",
    focus: "Lead, proposta, backlog, entrega e faturamento no mesmo fluxo."
  },
  {
    title: "Fabricas de software",
    focus: "Padronize projetos, operacao por cliente e continuidade entre times."
  },
  {
    title: "Startups de desenvolvimento",
    focus: "Conecte discovery, documentacao, execucao e acompanhamento do produto."
  },
  {
    title: "Consultorias por projeto",
    focus: "Venda, escopo, entrega e cobranca com menos troca de ferramenta."
  },
  {
    title: "Outras operacoes",
    focus: "A mesma base pode expandir para suporte, administrativo e fluxos especificos depois."
  }
];

export const architectureItems: HomeArchitectureItem[] = [
  {
    label: "Workspaces",
    detail: "Separe operacoes por cliente, unidade, squad ou frente sem perder o padrao do processo."
  },
  {
    label: "Boards",
    detail: "Organize execucao e acompanhamento sem desconectar o board do escopo, da documentacao e da cobranca."
  },
  {
    label: "Campos",
    detail: "Carregue dados comerciais, operacionais e financeiros que precisam atravessar a jornada."
  },
  {
    label: "Views",
    detail: "Leia o mesmo processo por kanban, lista, timeline e agenda conforme a necessidade da operacao."
  },
  {
    label: "Regras",
    detail: "Automacoes e criterios reduzem repeticao e ajudam a manter continuidade entre etapas."
  },
  {
    label: "Templates",
    detail: "Repita boas praticas de proposta, escopo, execucao e faturamento com consistencia."
  }
];
