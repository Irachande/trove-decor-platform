import { env } from "cloudflare:workers";
import {
  createPaySuitePayment,
  parsePlan,
  PLAN_CATALOG,
} from "../../../billing";
import {
  authorize,
  isAuthorizationResponse,
} from "../../../workspace";

export async function POST(request: Request) {
  try {
    const context = await authorize(request, "manageBilling");
    if (isAuthorizationResponse(context)) return context;
    const body = await request.json().catch(() => ({})) as { plan?: unknown };
    const plan = parsePlan(body.plan);
    if (plan === "Basic") {
      const collaborators = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM memberships WHERE business_id = ? AND status = 'Active' AND role != 'owner'",
      ).bind(context.businessId).first<{ count: number }>();
      if ((collaborators?.count || 0) > PLAN_CATALOG.Basic.collaboratorLimit!) {
        return Response.json(
          { error: "Remove extra collaborators before switching to Basic" },
          { status: 400 },
        );
      }
    }
    const subscription = await env.DB.prepare(
      "SELECT id, plan, status FROM subscriptions WHERE business_id = ?",
    ).bind(context.businessId).first<{
      id: number;
      plan: string;
      status: string;
    }>();
    if (!subscription) {
      return Response.json({ error: "Subscription not found" }, { status: 404 });
    }
    const createdAt = new Date().toISOString();
    const pendingSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const reusable = await env.DB.prepare(
      "SELECT id, checkout_url AS checkoutUrl FROM payments WHERE business_id = ? AND plan = ? AND status = 'Pending' AND created_at >= ? AND checkout_url IS NOT NULL ORDER BY id DESC LIMIT 1",
    ).bind(context.businessId, plan, pendingSince).first<{
      id: number;
      checkoutUrl: string;
    }>();
    if (reusable?.checkoutUrl) {
      return Response.json({
        ok: true,
        paymentId: reusable.id,
        checkoutUrl: reusable.checkoutUrl,
        reused: true,
      });
    }
    const reference = `TRV-${context.businessId}-${Date.now().toString(36)}`.slice(0, 50);
    const catalog = PLAN_CATALOG[plan];
    const kind = subscription.plan === plan ? "renewal" : "plan_change";
    const initiated = await env.DB.prepare(
      "INSERT INTO payments (business_id, subscription_id, provider, reference, kind, plan, amount, currency, status, created_at, updated_at) VALUES (?, ?, 'PaySuite', ?, ?, ?, ?, 'MZN', 'Initiated', ?, ?) RETURNING id",
    ).bind(
      context.businessId,
      subscription.id,
      reference,
      kind,
      plan,
      catalog.amount,
      createdAt,
      createdAt,
    ).first<{ id: number }>();
    if (!initiated) throw new Error("Unable to create payment record");

    const origin = new URL(request.url).origin;
    try {
      const payment = await createPaySuitePayment({
        amount: catalog.amount,
        reference,
        description: `Trove ${plan} — 1 mês`,
        returnUrl: `${origin}/?billing=return`,
        callbackUrl: `${origin}/api/billing/webhook`,
      });
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE payments SET provider_payment_id = ?, checkout_url = ?, status = 'Pending', updated_at = ? WHERE id = ? AND business_id = ?",
        ).bind(
          payment.providerPaymentId,
          payment.checkoutUrl,
          createdAt,
          initiated.id,
          context.businessId,
        ),
        env.DB.prepare(
          "UPDATE subscriptions SET pending_plan = ?, updated_at = ? WHERE id = ? AND business_id = ?",
        ).bind(plan, createdAt, subscription.id, context.businessId),
        env.DB.prepare(
          "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, 'createSubscriptionCheckout', 'payment', ?, 'Pagamento de subscrição iniciado', ?)",
        ).bind(
          context.businessId,
          context.userId,
          String(initiated.id),
          createdAt,
        ),
      ]);
      return Response.json({
        ok: true,
        paymentId: initiated.id,
        checkoutUrl: payment.checkoutUrl,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PAYMENTS_NOT_CONFIGURED") {
        await env.DB.prepare(
          "DELETE FROM payments WHERE id = ? AND business_id = ? AND status = 'Initiated'",
        ).bind(initiated.id, context.businessId).run();
        return Response.json(
          {
            error: "PaySuite is not configured yet",
            code: "PAYMENTS_NOT_CONFIGURED",
          },
          { status: 503 },
        );
      }
      const message = error instanceof Error ? error.message : "Payment provider unavailable";
      await env.DB.prepare(
        "UPDATE payments SET status = 'Failed', failure_reason = ?, updated_at = ? WHERE id = ? AND business_id = ?",
      ).bind(message.slice(0, 300), createdAt, initiated.id, context.businessId).run();
      return Response.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid billing request";
    return Response.json({ error: message }, { status: 400 });
  }
}
