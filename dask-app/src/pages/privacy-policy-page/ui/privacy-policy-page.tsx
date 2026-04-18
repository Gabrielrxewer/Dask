import "./privacy-policy-page.css";

const UPDATED_AT = "17 de abril de 2026";

export function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <article className="legal-page__content">
        <header className="legal-page__header">
          <p className="legal-page__eyebrow">Documento legal</p>
          <h1>Politica de Privacidade da Plataforma Dask</h1>
          <p>
            Esta Politica de Privacidade explica como dados pessoais sao coletados, utilizados, armazenados e
            protegidos durante o uso da plataforma Dask.
          </p>
          <p className="legal-page__updated">Ultima atualizacao: {UPDATED_AT}</p>
        </header>

        <section>
          <h2>1. Dados coletados</h2>
          <p>
            Podemos coletar dados de cadastro (nome, e-mail), dados de uso da plataforma, dados tecnicos de acesso e
            dados necessarios para operacao de pagamento e seguranca.
          </p>
        </section>

        <section>
          <h2>2. Finalidades do tratamento</h2>
          <p>
            Os dados sao tratados para autenticar usuarios, prestar o servico contratado, processar assinatura,
            melhorar desempenho, prevenir fraudes e cumprir obrigacoes legais.
          </p>
        </section>

        <section>
          <h2>3. Bases legais</h2>
          <p>
            O tratamento ocorre com base na execucao de contrato, cumprimento de obrigacoes legais, exercicio regular
            de direitos e interesses legitimos, nos termos da LGPD.
          </p>
        </section>

        <section>
          <h2>4. Compartilhamento de dados</h2>
          <p>
            Dados podem ser compartilhados com provedores essenciais para operacao (ex.: infraestrutura, autenticacao e
            pagamento), sempre sob requisitos de seguranca e confidencialidade.
          </p>
        </section>

        <section>
          <h2>5. Retencao e eliminacao</h2>
          <p>
            Os dados sao mantidos pelo periodo necessario para as finalidades descritas, observando prazos legais,
            auditoria, seguranca e defesa em processos administrativos ou judiciais.
          </p>
        </section>

        <section>
          <h2>6. Direitos do titular</h2>
          <p>
            O titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade, anonimização,
            eliminacao e revisao de decisoes automatizadas, conforme a legislacao aplicavel.
          </p>
        </section>

        <section>
          <h2>7. Seguranca da informacao</h2>
          <p>
            Adotamos medidas tecnicas e administrativas para proteger os dados contra acesso nao autorizado, alteracao,
            divulgacao e destruicao indevida.
          </p>
        </section>

        <section>
          <h2>8. Cookies e tecnologias similares</h2>
          <p>
            Utilizamos cookies e tecnologias equivalentes para autenticacao de sessao, seguranca, preferencias e
            melhoria da experiencia do usuario.
          </p>
        </section>

        <section>
          <h2>9. Atualizacoes desta politica</h2>
          <p>
            Esta Politica pode ser revisada periodicamente. A data de atualizacao sempre refletira a versao vigente do
            documento.
          </p>
        </section>
      </article>
    </main>
  );
}
