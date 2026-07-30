import { env } from "cloudflare:workers";

type EmailInput = {
  businessId: number;
  recipient: string;
  template: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export function emailConfiguration() {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || "",
    apiUrl: env.RESEND_API_URL?.trim() || "https://api.resend.com",
    from: env.EMAIL_FROM?.trim() || "",
    publicAppUrl:
      env.PUBLIC_APP_URL?.trim() ||
      "https://trove-decor-platform.irachande7.chatgpt.site",
  };
}

function deliveryId() {
  const random = crypto.getRandomValues(new Uint16Array(1))[0];
  return Date.now() * 1000 + random;
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

export async function sendTransactionalEmail(input: EmailInput) {
  const config = emailConfiguration();
  if (!config.apiKey || !config.from) {
    return { configured: false, sent: false, providerMessageId: null };
  }
  const id = deliveryId();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO email_deliveries (id, business_id, recipient, template, provider, status, error, created_at, updated_at) VALUES (?, ?, ?, ?, 'Resend', 'Sending', '', ?, ?)",
  ).bind(
    id,
    input.businessId,
    input.recipient.toLowerCase(),
    input.template,
    createdAt,
    createdAt,
  ).run();
  try {
    const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.recipient],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        tags: [{ name: "template", value: input.template }],
      }),
    });
    const result = await response.json().catch(() => ({})) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!response.ok || !result.id) {
      throw new Error(result.message || result.name || `Email provider returned ${response.status}`);
    }
    await env.DB.prepare(
      "UPDATE email_deliveries SET status = 'Sent', provider_message_id = ?, updated_at = ? WHERE id = ?",
    ).bind(result.id, new Date().toISOString(), id).run();
    return { configured: true, sent: true, providerMessageId: result.id };
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Email delivery failed")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 500);
    await env.DB.prepare(
      "UPDATE email_deliveries SET status = 'Failed', error = ?, updated_at = ? WHERE id = ?",
    ).bind(message, new Date().toISOString(), id).run();
    return { configured: true, sent: false, providerMessageId: null };
  }
}

export function invitationEmail(input: {
  businessName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  const business = escapeEmailHtml(input.businessName);
  const inviter = escapeEmailHtml(input.inviterName);
  const role = escapeEmailHtml(input.role);
  const url = escapeEmailHtml(input.inviteUrl);
  const expiry = new Date(input.expiresAt).toLocaleDateString("pt-MZ");
  return {
    subject: `Convite para colaborar com ${input.businessName} na Trove`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#262824">
      <p style="color:#b75d3f;font-weight:700;letter-spacing:2px">TROVE</p>
      <h1 style="font-family:Georgia,serif;font-weight:400">Junte-se à equipa de ${business}</h1>
      <p>${inviter} convidou-o para colaborar como <strong>${role}</strong>.</p>
      <p><a href="${url}" style="display:inline-block;background:#b75d3f;color:white;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700">Aceitar convite</a></p>
      <p style="color:#77786f;font-size:13px">O convite expira em ${expiry}. Entre com o mesmo endereço de email que recebeu esta mensagem.</p>
      <hr style="border:0;border-top:1px solid #ddd8cd;margin:28px 0">
      <p style="color:#77786f;font-size:12px">Trove · Inventário e reservas para empresas de decoração</p>
    </div>`,
    text: `${input.inviterName} convidou-o para colaborar com ${input.businessName} como ${input.role}. Aceite em ${input.inviteUrl}. O convite expira em ${expiry}.`,
  };
}
