import { routePaths } from "@/app/router";
import { LegalDocumentPage } from "../../legal-document-page/ui/legal-document-page";

const UPDATED_AT = "17 de abril de 2026";

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
      "Os planos sao recorrentes e cobrados mensalmente pelo provedor de pagamento integrado. A assinatura se renova automaticamente ate que o cancelamento seja solicitado.",
    featured: true,
    tag: "Assinatura"
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
      "O tratamento de dados pessoais ocorre conforme a Politica de Privacidade e a legislacao aplicavel, incluindo a LGPD.",
    tag: "LGPD"
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
          value: "Cobranca mensal com renovacao",
          description: "Os planos sao recorrentes, com cancelamento na area de gestao e manutencao do acesso ate o fim do periodo pago."
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
      sectionsDescription="Os topicos abaixo concentram as regras que governam uso, assinatura, cancelamento, propriedade intelectual, privacidade e atualizacoes deste documento."
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
