import { routePaths } from "@/app/router";
import { LegalDocumentPage } from "../../legal-document-page/ui/legal-document-page";

const UPDATED_AT = "17 de abril de 2026";

const sections = [
  {
    title: "Dados coletados",
    description:
      "Podemos coletar dados de cadastro, dados de uso da plataforma, dados tecnicos de acesso e dados necessarios para operacao de pagamento e seguranca.",
    featured: true,
    tag: "Dados"
  },
  {
    title: "Finalidades do tratamento",
    description:
      "Os dados sao tratados para autenticar usuarios, prestar o servico contratado, processar assinatura, melhorar desempenho, prevenir fraudes e cumprir obrigacoes legais."
  },
  {
    title: "Bases legais",
    description:
      "O tratamento ocorre com base na execucao de contrato, cumprimento de obrigacoes legais, exercicio regular de direitos e interesses legitimos, nos termos da LGPD.",
    tag: "LGPD"
  },
  {
    title: "Compartilhamento de dados",
    description:
      "Dados podem ser compartilhados com provedores essenciais para operacao, como infraestrutura, autenticacao e pagamento, sempre sob requisitos de seguranca e confidencialidade."
  },
  {
    title: "Retencao e eliminacao",
    description:
      "Os dados sao mantidos pelo periodo necessario para as finalidades descritas, observando prazos legais, auditoria, seguranca e defesa em processos administrativos ou judiciais."
  },
  {
    title: "Direitos do titular",
    description:
      "O titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade, anonimizacao, eliminacao e revisao de decisoes automatizadas, conforme a legislacao aplicavel.",
    tag: "Direitos"
  },
  {
    title: "Seguranca da informacao",
    description:
      "Adotamos medidas tecnicas e administrativas para proteger os dados contra acesso nao autorizado, alteracao, divulgacao e destruicao indevida.",
    featured: true,
    tag: "Seguranca"
  },
  {
    title: "Cookies e tecnologias similares",
    description:
      "Utilizamos cookies e tecnologias equivalentes para autenticacao de sessao, seguranca, preferencias e melhoria da experiencia do usuario."
  },
  {
    title: "Atualizacoes desta politica",
    description:
      "Esta Politica pode ser revisada periodicamente. A data de atualizacao sempre refletira a versao vigente do documento."
  }
];

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      pageClassName="legal-page--privacy"
      sectionsVariant="pillars"
      guideVariant="pillars"
      eyebrow="Documento legal"
      title="Politica de Privacidade"
      description="Esta Politica de Privacidade explica como dados pessoais sao coletados, utilizados, armazenados e protegidos durante o uso da plataforma Dask."
      updatedAt={UPDATED_AT}
      summary="A politica mostra quais dados entram na operacao, por que eles sao tratados, com quem podem ser compartilhados e quais direitos o titular pode exercer."
      badges={[
        { label: "Dados pessoais" },
        { label: "LGPD", tone: "warning" },
        { label: "Seguranca da informacao", tone: "success" }
      ]}
      highlights={[
        {
          label: "Coleta",
          value: "Cadastro, uso e sinais tecnicos",
          description: "A plataforma trata dados necessarios para autenticacao, operacao da conta, pagamento, seguranca e melhoria do servico."
        },
        {
          label: "Tratamento",
          value: "Contrato, obrigacoes legais e prevencao",
          description: "As finalidades cobrem entrega do servico, prevencao a fraudes, cumprimento regulatorio e suporte a operacao."
        },
        {
          label: "Titular",
          value: "Acesso, correcao e eliminacao",
          description: "A politica consolida os principais direitos previstos na legislacao aplicavel para revisao e controle dos dados."
        }
      ]}
      sections={sections}
      sectionsEyebrow="Leitura estruturada"
      sectionsTitle="Pontos centrais da politica"
      sectionsDescription="Os topicos abaixo organizam coleta, tratamento, compartilhamento, retencao, direitos do titular, seguranca e revisoes da politica vigente."
      guideEyebrow="Leitura rapida"
      guideTitle="Como esta politica se conecta ao uso do Dask"
      guideDescription="A pagina segue o mesmo ritmo visual da home para facilitar consulta. Assim, os pontos de privacidade ficam claros sem cair num bloco corrido de texto."
      guideItems={[
        {
          title: "Tratamento orientado pela operacao",
          description: "Os dados existem para autenticar, operar, cobrar, proteger a conta e manter o servico funcionando com rastreabilidade."
        },
        {
          title: "Compartilhamento controlado",
          description: "Somente provedores essenciais entram no fluxo e sempre com requisito de confidencialidade e seguranca."
        },
        {
          title: "Direitos preservados",
          description: "O titular pode pedir confirmacao, acesso, correcao, portabilidade, anonimizacao, eliminacao e revisao conforme a lei."
        }
      ]}
      complementaryEyebrow="Documento complementar"
      complementaryTitle="Termos que regem acesso e assinatura"
      complementaryDescription="Para ver as regras de uso da plataforma, cobranca recorrente, cancelamento, propriedade intelectual e limitacao de responsabilidade, consulte os Termos de Uso."
      complementaryLink={{
        label: "Ver termos de uso",
        to: routePaths.termsOfUse
      }}
    />
  );
}
