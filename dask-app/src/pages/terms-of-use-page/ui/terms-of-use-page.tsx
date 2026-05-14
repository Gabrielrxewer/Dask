import { routePaths } from "@/app/router";
import { LegalDocumentPage } from "../../legal-document-page/ui/legal-document-page";

export const SUBSCRIPTION_TERMS_VERSION = "2026-05-14";
const UPDATED_AT = "14 de maio de 2026";

const sections = [
  {
    title: "Aceitacao e elegibilidade",
    description:
      "Voce declara que possui capacidade legal para contratar e que as informacoes fornecidas no cadastro sao verdadeiras e atualizadas."
  },
  {
    title: "Conta e seguranca",
    description:
      "Voce e responsavel pela confidencialidade das credenciais de acesso e por todas as atividades realizadas em sua conta, devendo comunicar imediatamente qualquer uso nao autorizado."
  },
  {
    title: "Planos, cobranca e renovacao",
    description:
      "Os planos Basic, Pro e Business sao recorrentes, cobrados mensalmente pelo provedor de pagamento integrado e vinculados a workspace business. O plano Enterprise depende de proposta comercial, aceite contratual especifico e condicoes negociadas.",
    featured: true,
    tag: "Assinatura"
  },
  {
    title: "Aceite dos termos de assinatura",
    description:
      "Ao selecionar um plano, marcar o aceite legal e iniciar o checkout, voce concorda com estes Termos, com a Politica de Privacidade, com a recorrencia mensal, com os valores exibidos na tela de contratacao e com a autorizacao de cobranca pelo provedor de pagamento.",
    featured: true,
    tag: "Aceite"
  },
  {
    title: "Workspace business e plano personal obsoleto",
    description:
      "Novas contratacoes sao disponibilizadas como workspace business. O workspace personal permanece apenas como legado operacional e pode deixar de receber novas ativacoes enquanto a oferta business estiver vigente."
  },
  {
    title: "Cancelamento da assinatura",
    description:
      "O cancelamento pode ser solicitado a qualquer momento na area de gestao de assinatura. Salvo informacao em contrario no checkout, o cancelamento interrompe as proximas renovacoes e mantem o acesso ate o fim do periodo ja pago."
  },
  {
    title: "Reembolso",
    description:
      "Como regra geral, valores ja cobrados nao sao reembolsaveis. Excecoes podem ser analisadas caso a caso, conforme obrigacoes legais aplicaveis e analise de suporte."
  },
  {
    title: "Tributos, documentos fiscais e dados cadastrais",
    description:
      "Valores podem estar sujeitos a tributos conforme a legislacao aplicavel. O cliente deve manter dados fiscais corretos e completos para emissao de documentos, cobranças, recibos, comunicados e cumprimento de obrigacoes legais."
  },
  {
    title: "Disponibilidade e mudancas de planos",
    description:
      "O Dask pode evoluir funcionalidades, limites, valores, nomes de planos e regras comerciais, preservando direitos adquiridos do periodo contratado quando exigido pela lei aplicavel ou pelo contrato vigente."
  },
  {
    title: "Uso permitido e condutas proibidas",
    description:
      "E proibido utilizar a plataforma para atividades ilicitas, violacao de direitos de terceiros, tentativas de acesso nao autorizado, engenharia reversa indevida ou envio de conteudo malicioso.",
    tag: "Uso"
  },
  {
    title: "Propriedade intelectual",
    description:
      "A plataforma, marcas, layout, software e conteudo institucional pertencem ao Dask ou a seus licenciantes, sendo vedado o uso sem autorizacao."
  },
  {
    title: "Privacidade e protecao de dados",
    description:
      "O tratamento de dados pessoais ocorre conforme a Politica de Privacidade e a legislacao aplicavel, incluindo a LGPD. O Dask pode atuar como controlador ou operador conforme o contexto do dado tratado na plataforma.",
    tag: "LGPD"
  },
  {
    title: "Base legal e comunicações",
    description:
      "Dados podem ser tratados para execucao de contrato, cumprimento de obrigacao legal ou regulatoria, exercicio regular de direitos, prevencao a fraude, legitimo interesse e consentimento quando aplicavel. Comunicacoes transacionais sobre conta, assinatura, seguranca e cobranca fazem parte da prestacao do servico."
  },
  {
    title: "Limitacao de responsabilidade",
    description:
      "A plataforma e disponibilizada em esforco comercialmente razoavel. Na extensao permitida por lei, o Dask nao responde por danos indiretos, lucros cessantes ou perdas decorrentes de uso indevido do servico."
  },
  {
    title: "Alteracoes destes termos",
    description:
      "Estes Termos podem ser atualizados periodicamente. Quando houver alteracoes relevantes, sera exibido aviso na plataforma e a data de revisao sera atualizada."
  }
];

export function TermsOfUsePage() {
  return (
    <LegalDocumentPage
      pageClassName="legal-page--terms"
      sectionsVariant="pillars"
      guideVariant="pillars"
      eyebrow="Documento legal"
      title="Termos de Uso"
      description="Estes Termos de Uso regem o acesso e a utilizacao da plataforma Dask. Ao criar conta, acessar ou usar a plataforma, voce concorda com as condicoes abaixo."
      updatedAt={UPDATED_AT}
      summary="Os termos organizam o acesso a plataforma, o uso da conta, a assinatura recorrente e os limites de responsabilidade dentro da experiencia principal do Dask."
      badges={[
        { label: "Acesso a plataforma" },
        { label: "Assinatura recorrente", tone: "warning" },
        { label: "Uso responsavel", tone: "success" }
      ]}
      highlights={[
        {
          label: "Acesso",
          value: "Conta, autenticacao e seguranca",
          description: "A conta precisa ter dados corretos e o uso das credenciais segue sob responsabilidade do usuario."
        },
        {
          label: "Assinatura",
          value: "Basic, Pro e Business com renovacao",
          description: "Todos os planos self-service usam workspace business, recorrencia mensal e aceite explicito antes do checkout."
        },
        {
          label: "Limites",
          value: "Uso licito e protecao da plataforma",
          description: "Nao e permitido uso malicioso, acesso indevido, violacao de direitos de terceiros ou reproducao nao autorizada."
        }
      ]}
      sections={sections}
      sectionsEyebrow="Leitura estruturada"
      sectionsTitle="Clausulas principais"
      sectionsDescription="Os topicos abaixo concentram as regras que governam uso, assinatura, aceite legal, cancelamento, documentos fiscais, propriedade intelectual, privacidade e atualizacoes deste documento."
      guideEyebrow="Leitura rapida"
      guideTitle="Como interpretar estes termos"
      guideDescription="A pagina foi organizada no mesmo padrao visual da home para ficar escaneavel. O objetivo aqui e localizar rapidamente o que impacta cadastro, uso e assinatura."
      guideItems={[
        {
          title: "Conta sob sua responsabilidade",
          description: "Dados de cadastro e seguranca de acesso devem permanecer corretos e protegidos durante todo o uso da plataforma."
        },
        {
          title: "Assinatura com renovacao automatica",
          description: "A relacao comercial segue o plano contratado, com recorrencia mensal e cancelamento sem afetar o periodo ja pago."
        },
        {
          title: "Atualizacoes podem acontecer",
          description: "Sempre que houver revisao relevante, a plataforma atualiza a versao vigente e comunica a mudanca dentro do fluxo."
        }
      ]}
      complementaryEyebrow="Documento complementar"
      complementaryTitle="Politica de Privacidade"
      complementaryDescription="Para entender como os dados pessoais sao coletados, tratados, armazenados e protegidos durante o uso da plataforma, consulte a politica complementar."
      complementaryLink={{
        label: "Ver politica de privacidade",
        to: routePaths.privacyPolicy
      }}
    />
  );
}
