import "./terms-of-use-page.css";

const UPDATED_AT = "17 de abril de 2026";

export function TermsOfUsePage() {
  return (
    <main className="home-page legal-page">
      <div className="home-page__container legal-page__container">
        <article className="legal-page__content">
          <header className="home-page__section-intro legal-page__header">
            <p className="home-page__section-eyebrow legal-page__eyebrow">Documento legal</p>
            <h1 className="home-page__section-title legal-page__title">
              <span className="legal-page__title-main">Termos de Uso</span>
              <span className="legal-page__title-context">Plataforma Dask</span>
            </h1>
            <p className="home-page__section-description legal-page__description">
              Estes Termos de Uso regem o acesso e a utilizacao da plataforma Dask. Ao criar conta, acessar ou usar a
              plataforma, voce concorda com as condicoes abaixo.
            </p>
            <p className="legal-page__updated">Ultima atualizacao: {UPDATED_AT}</p>
          </header>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">1. Aceitacao e elegibilidade</h2>
            <p>
              Voce declara que possui capacidade legal para contratar e que as informacoes fornecidas no cadastro sao
              verdadeiras e atualizadas.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">2. Conta e seguranca</h2>
            <p>
              Voce e responsavel pela confidencialidade das credenciais de acesso e por todas as atividades realizadas em
              sua conta, devendo comunicar imediatamente qualquer uso nao autorizado.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">3. Planos, cobranca e renovacao</h2>
            <p>
              Os planos sao recorrentes e cobrados mensalmente pelo provedor de pagamento integrado. A assinatura se
              renova automaticamente ate que o cancelamento seja solicitado.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">4. Cancelamento da assinatura</h2>
            <p>
              O cancelamento pode ser solicitado a qualquer momento na area de gestao de assinatura. Salvo informacao em
              contrario no checkout, o cancelamento interrompe as proximas renovacoes e mantem o acesso ate o fim do
              periodo ja pago.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">5. Reembolso</h2>
            <p>
              Como regra geral, valores ja cobrados nao sao reembolsaveis. Excecoes podem ser analisadas caso a caso,
              conforme obrigacoes legais aplicaveis e analise de suporte.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">6. Uso permitido e condutas proibidas</h2>
            <p>
              E proibido utilizar a plataforma para atividades ilicitas, violacao de direitos de terceiros, tentativas de
              acesso nao autorizado, engenharia reversa indevida ou envio de conteudo malicioso.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">7. Propriedade intelectual</h2>
            <p>
              A plataforma, marcas, layout, software e conteudo institucional pertencem ao Dask ou a seus licenciantes,
              sendo vedado o uso sem autorizacao.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">8. Privacidade e protecao de dados</h2>
            <p>
              O tratamento de dados pessoais ocorre conforme a Politica de Privacidade e a legislacao aplicavel,
              incluindo a LGPD.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">9. Limitacao de responsabilidade</h2>
            <p>
              A plataforma e disponibilizada em esforco comercialmente razoavel. Na extensao permitida por lei, o Dask
              nao responde por danos indiretos, lucros cessantes ou perdas decorrentes de uso indevido do servico.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">10. Alteracoes destes Termos</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. Quando houver alteracoes relevantes, sera exibido aviso
              na plataforma e a data de revisao sera atualizada.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
