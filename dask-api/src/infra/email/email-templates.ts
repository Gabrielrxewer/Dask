function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: #18181b; padding: 32px 40px; text-align: center; }
    .header-logo { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .body { padding: 40px; }
    .greeting { font-size: 22px; font-weight: 600; margin-bottom: 16px; color: #18181b; }
    .text { font-size: 15px; line-height: 1.6; color: #52525b; margin-bottom: 16px; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 28px 0; }
    .fallback { font-size: 13px; color: #71717a; word-break: break-all; }
    .fallback a { color: #3f3f46; }
    .footer { background: #f4f4f5; padding: 20px 40px; text-align: center; font-size: 12px; color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Dask</div>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      Você está recebendo este e-mail porque foi solicitado em sua conta Dask.<br />
      Se não foi você, pode ignorar este e-mail com segurança.
    </div>
  </div>
</body>
</html>`;
}

export function passwordResetTemplate(name: string, resetUrl: string): { html: string; text: string } {
  const firstName = name.split(' ')[0];

  const html = baseLayout(
    'Redefinição de senha — Dask',
    `<p class="greeting">Olá, ${firstName}!</p>
    <p class="text">Recebemos uma solicitação para redefinir a senha da sua conta Dask. Clique no botão abaixo para criar uma nova senha.</p>
    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn">Redefinir minha senha</a>
    </div>
    <p class="text">Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, pode ignorar este e-mail — sua senha permanece a mesma.</p>
    <hr class="divider" />
    <p class="fallback">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${resetUrl}">${resetUrl}</a></p>`
  );

  const text = `Olá, ${firstName}!\n\nRecebemos uma solicitação para redefinir sua senha no Dask.\n\nAcesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetUrl}\n\nSe não foi você, ignore este e-mail.`;

  return { html, text };
}

export function passwordChangedAlertTemplate(name: string): { html: string; text: string } {
  const firstName = name.split(' ')[0];
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

  const html = baseLayout(
    'Senha alterada — Dask',
    `<p class="greeting">Olá, ${firstName}.</p>
    <p class="text">Sua senha no Dask foi alterada com sucesso em <strong>${now}</strong>.</p>
    <p class="text">Se foi você, pode ignorar este aviso. Se não reconhece esta alteração, redefina sua senha imediatamente ou entre em contato com o suporte.</p>
    <hr class="divider" />`
  );

  const text = `Olá, ${firstName}.\n\nSua senha no Dask foi alterada em ${now}.\n\nSe não foi você, redefina sua senha imediatamente.`;

  return { html, text };
}

export function emailVerificationTemplate(name: string, verifyUrl: string): { html: string; text: string } {
  const firstName = name.split(' ')[0];

  const html = baseLayout(
    'Confirme seu e-mail — Dask',
    `<p class="greeting">Bem-vindo ao Dask, ${firstName}!</p>
    <p class="text">Sua conta foi criada com sucesso. Confirme seu endereço de e-mail clicando no botão abaixo para ativar todos os recursos da sua conta.</p>
    <div class="btn-wrap">
      <a href="${verifyUrl}" class="btn">Confirmar meu e-mail</a>
    </div>
    <p class="text">Este link expira em <strong>24 horas</strong>.</p>
    <hr class="divider" />
    <p class="fallback">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${verifyUrl}">${verifyUrl}</a></p>`
  );

  const text = `Bem-vindo ao Dask, ${firstName}!\n\nConfirme seu endereço de e-mail acessando o link abaixo (válido por 24 horas):\n${verifyUrl}\n\nSe não criou uma conta, ignore este e-mail.`;

  return { html, text };
}

export function checkoutLinkTemplate(input: {
  workspaceName: string;
  description: string;
  amount: string;
  checkoutUrl: string;
}): { html: string; text: string } {
  const html = baseLayout(
    `Cobrança de ${input.workspaceName} — Dask`,
    `<p class="greeting">Você recebeu uma cobrança.</p>
    <p class="text"><strong>${input.workspaceName}</strong> enviou um link de pagamento para você via Dask.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr style="background:#f4f4f5;">
        <td style="padding:10px 16px;font-size:13px;color:#71717a;font-weight:600;">Descrição</td>
        <td style="padding:10px 16px;font-size:13px;color:#18181b;">${input.description}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#71717a;font-weight:600;">Valor</td>
        <td style="padding:10px 16px;font-size:15px;color:#18181b;font-weight:700;">${input.amount}</td>
      </tr>
    </table>
    <p class="text">Clique no botão abaixo para realizar o pagamento com segurança via Stripe.</p>
    <div class="btn-wrap">
      <a href="${input.checkoutUrl}" class="btn">Pagar agora</a>
    </div>
    <p class="text" style="font-size:13px;color:#71717a;">O link de pagamento é de uso único e expira em 24 horas.</p>
    <hr class="divider" />
    <p class="fallback">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${input.checkoutUrl}">${input.checkoutUrl}</a></p>`
  );

  const text =
    `Você recebeu uma cobrança de ${input.workspaceName}.\n\n` +
    `Descrição: ${input.description}\n` +
    `Valor: ${input.amount}\n\n` +
    `Acesse o link abaixo para pagar:\n${input.checkoutUrl}\n\n` +
    `O link expira em 24 horas.`;

  return { html, text };
}

export function paymentReminderTemplate(input: {
  workspaceName: string;
  description: string;
  amount: string;
  checkoutUrl: string;
}): { html: string; text: string } {
  const html = baseLayout(
    `Lembre-se de pagar — ${input.workspaceName}`,
    `<p class="greeting">Lembre-se de pagar.</p>
    <p class="text"><strong>${input.workspaceName}</strong> está aguardando a conclusão do seu pagamento.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr style="background:#f4f4f5;">
        <td style="padding:10px 16px;font-size:13px;color:#71717a;font-weight:600;">Descrição</td>
        <td style="padding:10px 16px;font-size:13px;color:#18181b;">${input.description}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;font-size:13px;color:#71717a;font-weight:600;">Valor</td>
        <td style="padding:10px 16px;font-size:15px;color:#18181b;font-weight:700;">${input.amount}</td>
      </tr>
    </table>
    <p class="text">Seu link de pagamento ainda está ativo. Clique abaixo para finalizar com segurança via Stripe.</p>
    <div class="btn-wrap">
      <a href="${input.checkoutUrl}" class="btn">Finalizar pagamento</a>
    </div>
    <hr class="divider" />
    <p class="fallback">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${input.checkoutUrl}">${input.checkoutUrl}</a></p>`
  );

  const text =
    `Lembre-se de pagar — ${input.workspaceName}\n\n` +
    `Você tem um pagamento pendente:\n` +
    `Descrição: ${input.description}\n` +
    `Valor: ${input.amount}\n\n` +
    `Acesse o link abaixo para finalizar o pagamento:\n${input.checkoutUrl}`;

  return { html, text };
}

export function workspaceInviteTemplate(input: {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}): { html: string; text: string } {
  const inviterFirstName = input.inviterName.split(' ')[0];

  const html = baseLayout(
    'Convite para workspace — Dask',
    `<p class="greeting">Você recebeu um convite no Dask.</p>
    <p class="text"><strong>${input.inviterName}</strong> convidou você para entrar no workspace <strong>${input.workspaceName}</strong> com role inicial <strong>${input.role}</strong>.</p>
    <div class="btn-wrap">
      <a href="${input.inviteUrl}" class="btn">Aceitar convite</a>
    </div>
    <p class="text">Ao abrir o link, você pode criar conta ou entrar. Se o e-mail da conta for este e-mail convidado, o acesso ao workspace será liberado automaticamente.</p>
    <hr class="divider" />
    <p class="fallback">Se o botão não funcionar, copie e cole este link no navegador:<br /><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>`
  );

  const text =
    `Você recebeu um convite no Dask.\n\n` +
    `${inviterFirstName} convidou você para entrar no workspace ${input.workspaceName} com role inicial ${input.role}.\n\n` +
    `Abra este link para aceitar:\n${input.inviteUrl}\n\n` +
    `Ao entrar ou criar conta com este e-mail convidado, o acesso ao workspace será liberado automaticamente.`;

  return { html, text };
}
