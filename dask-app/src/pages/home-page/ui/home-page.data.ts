import type {
  HomeActivity,
  HomeAudience,
  HomeAutomationStep,
  HomeAuditLog,
  HomeBadge,
  HomeComparisonRow,
  HomeDeal,
  HomeInsightMetric,
  HomeMetric,
  HomeModule,
  HomePlan,
  HomePipelineStage,
  HomeProblem,
  HomeRevenueStep,
  HomeTrustItem
} from "./home-page.types";

export const heroBadges: HomeBadge[] = [
  { label: "Visao 360 do cliente", tone: "accent" },
  { label: "Processos configuraveis" },
  { label: "Automacoes + IA" },
  { label: "Fiscal e cobrancas nativas", tone: "warm" }
];

export const heroMetrics: HomeMetric[] = [
  { label: "Receita prevista", value: "R$ 2,48M", detail: "+12,5% vs mes anterior", tone: "accent" },
  { label: "Receita contratada", value: "R$ 1,68M", detail: "+8,2% vs mes anterior", tone: "success" },
  { label: "Receita realizada", value: "R$ 1,12M", detail: "+5,7% vs mes anterior", tone: "accent" },
  { label: "Inadimplencia", value: "R$ 38,4K", detail: "2,7% da receita", tone: "warm" }
];

export const pipelineStages: HomePipelineStage[] = [
  { label: "Signal", progress: 100, isDone: true },
  { label: "Lead", progress: 100, isDone: true },
  { label: "Proposta", progress: 82, isActive: true },
  { label: "Contrato", progress: 64 },
  { label: "Cobranca", progress: 48 },
  { label: "Pago", progress: 26 },
  { label: "Fiscal", progress: 12 },
  { label: "Onboarding", progress: 0 }
];

export const heroDeals: HomeDeal[] = [
  {
    account: "Acme Corp",
    scope: "Projeto UX + Design System",
    amount: "R$ 110.000",
    status: "Proposta",
    progress: 70,
    tone: "accent"
  },
  {
    account: "Beta Sistemas",
    scope: "Plataforma Web",
    amount: "R$ 198.000",
    status: "Contrato",
    progress: 100,
    tone: "success"
  },
  {
    account: "Cybernet",
    scope: "Suporte + Evolucao",
    amount: "R$ 80.000",
    status: "Cobranca",
    progress: 60,
    tone: "warm"
  }
];

export const heroActivities: HomeActivity[] = [
  { icon: "file", label: "Contrato assinado por Acme Corp", time: "ha 2h" },
  { icon: "billing", label: "Boleto gerado #04518 - Beta Sistemas", time: "ha 3h" },
  { icon: "receipt", label: "NFe emitida #0002345 - Beta Sistemas", time: "ha 3h" },
  { icon: "check", label: "Pagamento confirmado - boleto #04578", time: "ha 6h" },
  { icon: "users", label: "Tarefa criada: onboarding - Acme Corp", time: "ha 1d" }
];

export const proofSegments = ["Agencias", "Software houses", "Consultorias", "Assessorias", "Servicos B2B", "Operacoes recorrentes"];

export const problemCards: HomeProblem[] = [
  {
    icon: "layers",
    title: "Processos desconectados",
    description: "Leads no CRM, propostas no planilho, contratos no docs, cobrancas no financeiro e notas no sistema fiscal."
  },
  {
    icon: "link",
    title: "Perda de informacao",
    description: "Dados se perdem entre e-mails, planilhas e ferramentas sem integracao operacional."
  },
  {
    icon: "trend-up",
    title: "Falta de previsibilidade",
    description: "Fica dificil prever receita, entender gargalos e tomar decisao com seguranca."
  },
  {
    icon: "receipt",
    title: "Risco fiscal e financeiro",
    description: "Erros manuais, boletos em atraso, notas fora do prazo e falta de controle de impostos."
  },
  {
    icon: "automation",
    title: "Escalabilidade limitada",
    description: "Sem processos e automacoes, a empresa nao cresce com estrutura."
  }
];

export const revenueSteps: HomeRevenueStep[] = [
  { icon: "zap", title: "Signal", description: "Fontes de entrada capturam sinais de oportunidade." },
  { icon: "users", title: "Lead", description: "Leads qualificados e enriquecidos no CRM." },
  { icon: "file", title: "Proposta", description: "Propostas personalizadas com regras e aprovacoes." },
  { icon: "documentation", title: "Contrato", description: "Contratos digitais com assinatura e clausulas dinamicas." },
  { icon: "billing", title: "Cobranca", description: "Boletos, pix e recorrencia com controle de inadimplencia." },
  { icon: "check", title: "Pago", description: "Conciliacao automatica e baixa em tempo real." },
  { icon: "receipt", title: "Fiscal", description: "Emissao de NFe e controle fiscal automatico." },
  { icon: "briefcase", title: "Onboarding", description: "Entrega, tarefas e onboarding do cliente." }
];

export const modules: HomeModule[] = [
  {
    icon: "board",
    title: "CRM & Pipeline",
    description: "Gestao de leads, contas, contatos e oportunidades com pipeline avancado."
  },
  {
    icon: "file",
    title: "Propostas",
    description: "Modelos inteligentes, precificacao, aprovacoes e versionamento."
  },
  {
    icon: "documentation",
    title: "Contratos",
    description: "Contratos digitais, assinatura eletronica e renovacao automatica."
  },
  {
    icon: "billing",
    title: "Cobrancas",
    description: "Boletos, pix, cartao e recorrencia com gestao de inadimplencia."
  },
  {
    icon: "receipt",
    title: "Fiscal",
    description: "Emissao de NFe, NFSe, CTe, MDFe e controle de impostos."
  },
  {
    icon: "briefcase",
    title: "Onboarding & Entrega",
    description: "Fluxos de entrada, tarefas, checklists e acompanhamento do cliente."
  },
  {
    icon: "trend-up",
    title: "Relatorios & IA",
    description: "Dashboards em tempo real, previsoes e insights acionaveis com IA."
  },
  {
    icon: "automation",
    title: "Automacoes",
    description: "Aprovacoes, logs, delays, mensagens e execucoes rastreaveis."
  }
];

export const plans: HomePlan[] = [
  {
    code: "BASIC",
    name: "Basic",
    price: "R$ 149,90",
    period: "/mes",
    description: "Para iniciar a operacao em workspace business com os fluxos essenciais do Dask.",
    features: ["Workspace business", "Boards, lista e agenda", "Documentacao operacional", "Cobranca mensal recorrente"],
    ctaLabel: "Assinar Basic"
  },
  {
    code: "PRO",
    name: "Pro",
    price: "R$ 299,90",
    period: "/mes",
    description: "Para times que precisam de mais automacao, visibilidade e continuidade entre comercial e entrega.",
    features: ["Tudo do Basic", "Automacoes e IA contextual", "Comercial e documentacao integrados", "Gestao de assinatura e billing"],
    ctaLabel: "Assinar Pro"
  },
  {
    code: "BUSINESS",
    name: "Business",
    price: "R$ 499,90",
    period: "/mes",
    description: "Para operacoes com governanca, fiscal, billing Connect e multiplas frentes de trabalho.",
    features: ["Tudo do Pro", "Fiscal e Stripe Connect", "Permissoes e auditoria", "Workspaces business para equipe"],
    isFeatured: true,
    ctaLabel: "Assinar Business"
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para operacoes com contrato, implantacao assistida e condicoes comerciais sob medida.",
    features: ["Tudo do Business", "Condicoes negociadas", "Suporte e onboarding assistido", "Contrato empresarial"],
    ctaLabel: "Falar com comercial"
  }
];

export const comparisonRows: HomeComparisonRow[] = [
  { commonCrm: "Focado em leads e vendas", dask: "Cobre todo o ciclo de receita" },
  { commonCrm: "Dados desconectados", dask: "Dados conectados ponta a ponta" },
  { commonCrm: "Processos rigidos", dask: "100% configuravel e flexivel" },
  { commonCrm: "Sem fiscal ou financeiro nativo", dask: "Fiscal, cobrancas e financeiro nativos" },
  { commonCrm: "Relatorios limitados", dask: "Visao 360 e relatorios avancados" },
  { commonCrm: "Cresce em complexidade e custo", dask: "Escala com governanca e controle" }
];

export const insightMetrics: HomeInsightMetric[] = [
  { label: "Taxa de conversao", value: "24,6%", detail: "+3,2% vs mes anterior" },
  { label: "Ciclo medio de vendas", value: "18 dias", detail: "-2 dias vs mes anterior" },
  { label: "Ticket medio", value: "R$ 46.800", detail: "+7,1% vs mes anterior" },
  { label: "Inadimplencia", value: "2,7%", detail: "-0,8% vs mes anterior" }
];

export const audiences: HomeAudience[] = [
  {
    icon: "users",
    title: "Agencias",
    description: "Gestao de projetos, escopo, repasses e recorrencias com visao de margem por cliente."
  },
  {
    icon: "code",
    title: "Software Houses",
    description: "Contratos de desenvolvimento, manutencao e suporte com cobranca recorrente."
  },
  {
    icon: "briefcase",
    title: "Consultorias",
    description: "Projetos, horas, aditivos e renovacoes com previsibilidade de receita."
  },
  {
    icon: "user",
    title: "Servicos B2B",
    description: "Qualquer empresa de servicos que precisa de controle, escala e previsibilidade."
  }
];

export const automationSteps: HomeAutomationStep[] = [
  { title: "Captura de sinais", description: "IA identifica oportunidades nas suas fontes de entrada." },
  { title: "Qualificacao automatica", description: "Leads sao enriquecidos e pontuados automaticamente." },
  { title: "Propostas inteligentes", description: "IA sugere escopo, preco e prazos com base em dados." },
  { title: "Aprovacoes & contratos", description: "Fluxos de aprovacao e geracao automatica de contratos." },
  { title: "Cobrancas & fiscal", description: "Geracao de boletos, NFe e controle fiscal automaticos." },
  { title: "Analise & previsao", description: "IA analisa dados e preve receita e riscos." }
];

export const trustItems: HomeTrustItem[] = [
  { title: "Trilhas de auditoria completas", description: "Cada acao importante deixa rastro operacional." },
  { title: "Logs de todas as acoes e alteracoes", description: "Automacoes, documentos e status ficam rastreaveis." },
  { title: "Permissoes granulares por time e perfil", description: "Controle quem pode ver, editar, aprovar e executar." },
  { title: "Ambiente seguro e em conformidade", description: "Governanca para operacao comercial e dados de clientes." },
  { title: "Backups automaticos e alta disponibilidade", description: "Operacao preparada para crescer sem perder controle." }
];

export const auditLogs: HomeAuditLog[] = [
  { time: "24/05/2025 10:32", event: "Maria Silva alterou o estagio do negocio Acme Corp para Contrato" },
  { time: "24/05/2025 10:28", event: "Joao Santos gerou o boleto #04578 para Beta Sistemas" },
  { time: "24/05/2025 10:25", event: "Sistema emitiu NFe #00012345 para Beta Sistemas" },
  { time: "24/05/2025 10:20", event: "Pagamento confirmado do boleto #04578 - R$ 19.800,00" }
];
