import { env } from "cloudflare:workers";
import {
  paymentConfiguration,
  sha256Hex,
  verifyPaySuiteSignature,
} from "../../../billing";
import { ensureWorkspaceDatabase } from "../../../workspace";

type PaySuiteWebhook = {
  event?: string;
  request_id?: string;
  data?: {
    id?: string;
    amount?: number;
    reference?: string;
    error?: string;
    transaction?: {
      id?: string;
      method?: string;
      paid_at?: string;
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") || "";
  if (!paymentConfiguration().webhookSecret) {
    return Response.json(
      { error: "Webhook secret is not configured" },
      { status: 503 },
    );
  }
  if (!(await verifyPaySuiteSignature(rawBody, signature))) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: PaySuiteWebhook;
  try {
    event = JSON.parse(rawBody) as PaySuiteWebhook;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestId = String(event.request_id || "").slice(0, 160);
  const eventType = String(event.event || "").slice(0, 80);
  if (!requestId || !eventType || !event.data?.id || !event.data.reference) {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  await ensureWorkspaceDatabase();
  const processedAt = new Date().toISOString();
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO payment_webhook_events (provider, request_id, event_type, payload_hash, status, processed_at) VALUES ('PaySuite', ?, ?, ?, 'Processing', ?)",
  ).bind(
    requestId,
    eventType,
    await sha256Hex(rawBody),
    processedAt,
  ).run();
  if (!inserted.meta.changes) {
    return Response.json({ ok: true, duplicate: true });
  }

  const payment = await env.DB.prepare(
    "SELECT p.id, p.business_id AS businessId, p.subscription_id AS subscriptionId, p.plan, p.amount, p.status, s.current_period_end AS currentPeriodEnd FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE p.provider_payment_id = ? AND p.reference = ?",
  ).bind(event.data.id, event.data.reference).first<{
    id: number;
    businessId: number;
    subscriptionId: number;
    plan: "Basic" | "Network";
    amount: number;
    status: string;
    currentPeriodEnd: string;
  }>();
  if (!payment) {
    await env.DB.prepare(
      "UPDATE payment_webhook_events SET status = 'PaymentNotFound' WHERE request_id = ?",
    ).bind(requestId).run();
    return Response.json({ error: "Payment not found" }, { status: 404 });
  }
  if (Number(event.data.amount) !== payment.amount) {
    await env.DB.prepare(
      "UPDATE payment_webhook_events SET status = 'AmountMismatch' WHERE request_id = ?",
    ).bind(requestId).run();
    return Response.json({ error: "Payment amount mismatch" }, { status: 400 });
  }
  if (payment.status === "Paid") {
    await env.DB.prepare(
      "UPDATE payment_webhook_events SET status = 'AlreadyPaid' WHERE request_id = ?",
    ).bind(requestId).run();
    return Response.json({ ok: true, duplicate: true });
  }

  if (eventType === "payment.success") {
    const paidAt = event.data.transaction?.paid_at || processedAt;
    const periodStart =
      payment.currentPeriodEnd > paidAt ? payment.currentPeriodEnd : paidAt;
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
    const receiptNumber = `TRV-${new Date(paidAt).getUTCFullYear()}-${String(payment.id).padStart(6, "0")}`;
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE payments SET status = 'Paid', method = ?, paid_at = ?, receipt_number = ?, failure_reason = NULL, updated_at = ? WHERE id = ?",
      ).bind(
        event.data.transaction?.method || "",
        paidAt,
        receiptNumber,
        processedAt,
        payment.id,
      ),
      env.DB.prepare(
        "UPDATE subscriptions SET plan = ?, pending_plan = NULL, status = 'Active', amount = ?, current_period_start = ?, current_period_end = ?, grace_until = NULL, cancel_at_period_end = 0, updated_at = ? WHERE id = ?",
      ).bind(
        payment.plan,
        payment.amount,
        periodStart,
        periodEnd.toISOString(),
        processedAt,
        payment.subscriptionId,
      ),
      env.DB.prepare(
        "UPDATE businesses SET plan = ? WHERE id = ?",
      ).bind(payment.plan, payment.businessId),
      env.DB.prepare(
        "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, NULL, 'paymentSuccess', 'payment', ?, 'Pagamento de subscrição confirmado', ?)",
      ).bind(payment.businessId, String(payment.id), processedAt),
      env.DB.prepare(
        "INSERT OR IGNORE INTO notifications (business_id, user_id, type, title_pt, title_en, body_pt, body_en, link, source_key, created_at) SELECT ?, user_id, 'billing', 'Pagamento confirmado', 'Payment confirmed', ?, ?, '', ?, ? FROM memberships WHERE business_id = ? AND status = 'Active'",
      ).bind(
        payment.businessId,
        `O plano ${payment.plan} está activo até ${periodEnd.toISOString().slice(0, 10)}.`,
        `The ${payment.plan} plan is active until ${periodEnd.toISOString().slice(0, 10)}.`,
        `billing-paid:${payment.id}`,
        processedAt,
        payment.businessId,
      ),
      env.DB.prepare(
        "UPDATE payment_webhook_events SET status = 'Processed' WHERE request_id = ?",
      ).bind(requestId),
    ]);
  } else if (eventType === "payment.failed") {
    const graceUntil = new Date(processedAt);
    graceUntil.setUTCDate(graceUntil.getUTCDate() + 7);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE payments SET status = 'Failed', failure_reason = ?, updated_at = ? WHERE id = ?",
      ).bind(String(event.data.error || "Payment failed").slice(0, 300), processedAt, payment.id),
      env.DB.prepare(
        "UPDATE subscriptions SET status = CASE WHEN current_period_end <= ? THEN 'Grace' ELSE status END, grace_until = CASE WHEN current_period_end <= ? THEN ? ELSE grace_until END, updated_at = ? WHERE id = ?",
      ).bind(processedAt, processedAt, graceUntil.toISOString(), processedAt, payment.subscriptionId),
      env.DB.prepare(
        "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, NULL, 'paymentFailed', 'payment', ?, 'Pagamento de subscrição falhou', ?)",
      ).bind(payment.businessId, String(payment.id), processedAt),
      env.DB.prepare(
        "UPDATE payment_webhook_events SET status = 'Processed' WHERE request_id = ?",
      ).bind(requestId),
    ]);
  } else {
    await env.DB.prepare(
      "UPDATE payment_webhook_events SET status = 'Ignored' WHERE request_id = ?",
    ).bind(requestId).run();
  }
  return Response.json({ ok: true });
}
