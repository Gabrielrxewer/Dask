import "./privacy-policy-page.css";

const UPDATED_AT = "17 de abril de 2026";

export function PrivacyPolicyPage() {
  return (
    <main className="home-page legal-page">
      <div className="home-page__container legal-page__container">
        <article className="legal-page__content">
          <header className="home-page__section-intro legal-page__header">
            <p className="home-page__section-eyebrow legal-page__eyebrow">Documento legal</p>
            <h1 className="home-page__section-title legal-page__title">Politica de Privacidade da Plataforma Dask</h1>
            <p className="home-page__section-description legal-page__description">
              Esta Politica de Privacidade explica como dados pessoais sao coletados, utilizados, armazenados e
              protegidos durante o uso da plataforma Dask.
            </p>
            <p className="legal-page__updated">Ultima atualizacao: {UPDATED_AT}</p>
          </header>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">1. Dados coletados</h2>
            <p>
              Podemos coletar dados de cadastro (nome, e-mail), dados de uso da plataforma, dados tecnicos de acesso e
              dados necessarios para operacao de pagamento e seguranca.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">2. Finalidades do tratamento</h2>
            <p>
              Os dados sao tratados para autenticar usuarios, prestar o servico contratado, processar assinatura,
              melhorar desempenho, prevenir fraudes e cumprir obrigacoes legais.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">3. Bases legais</h2>
            <p>
              O tratamento ocorre com base na execucao de contrato, cumprimento de obrigacoes legais, exercicio regular
              de direitos e interesses legitimos, nos termos da LGPD.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">4. Compartilhamento de dados</h2>
            <p>
              Dados podem ser compartilhados com provedores essenciais para operacao (ex.: infraestrutura, autenticacao e
              pagamento), sempre sob requisitos de seguranca e confidencialidade.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">5. Retencao e eliminacao</h2>
            <p>
              Os dados sao mantidos pelo periodo necessario para as finalidades descritas, observando prazos legais,
              auditoria, seguranca e defesa em processos administrativos ou judiciais.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">6. Direitos do titular</h2>
            <p>
              O titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade, anonimizacao,
              eliminacao e revisao de decisoes automatizadas, conforme a legislacao aplicavel.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">7. Seguranca da informacao</h2>
            <p>
              Adotamos medidas tecnicas e administrativas para proteger os dados contra acesso nao autorizado, alteracao,
              divulgacao e destruicao indevida.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section">
            <h2 className="home-page__feature-title">8. Cookies e tecnologias similares</h2>
            <p>
              Utilizamos cookies e tecnologias equivalentes para autenticacao de sessao, seguranca, preferencias e
              melhoria da experiencia do usuario.
            </p>
          </section>

          <section className="home-page__feature-card legal-page__section legal-page__section--wide">
            <h2 className="home-page__feature-title">9. Atualizacoes desta politica</h2>
            <p>
              Esta Politica pode ser revisada periodicamente. A data de atualizacao sempre refletira a versao vigente do
              documento.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
