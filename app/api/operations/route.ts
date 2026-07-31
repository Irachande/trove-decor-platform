import { env } from "cloudflare:workers";
import { authorize, isAuthorizationResponse } from "../../workspace";
import { webPushConfiguration } from "../../web-push";

type Body = {
  action?: string;
  category?: string;
  rating?: number;
  message?: string;
  source?: string;
  route?: string;
};

function clean(value: unknown, max: number) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export async function GET(request: Request) {
  const context = await authorize(request, "manageTeam");
  if (isAuthorizationResponse(context)) return context;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [events, subscriptions, feedback] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS total, MAX(created_at) AS latest FROM operational_events WHERE business_id = ? AND created_at >= ?",
    ).bind(context.businessId, since).first<{ total: number; latest: string | null }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS total FROM push_subscriptions WHERE business_id = ? AND enabled = 1",
    ).bind(context.businessId).first<{ total: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS total FROM beta_feedback WHERE business_id = ?",
    ).bind(context.businessId).first<{ total: number }>(),
  ]);
  const config = webPushConfiguration();
  return Response.json({
    status: "operational",
    clientErrors24h: Number(events?.total || 0),
    latestClientError: events?.latest || null,
    pushDevices: Number(subscriptions?.total || 0),
    pushConfigured: Boolean(config.publicKey && config.privateKey && config.subject),
    feedbackEntries: Number(feedback?.total || 0),
    checkedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const context = await authorize(request);
    if (isAuthorizationResponse(context)) return context;
    const body = await request.json() as Body;
    const action = clean(body.action, 40);
    const timestamp = new Date().toISOString();
    if (action === "clientError") {
      const message = clean(body.message, 500);
      if (!message) return Response.json({ error: "Message is required" }, { status: 400 });
      await env.DB.prepare(
        "INSERT INTO operational_events (id, business_id, user_id, severity, source, message, route, created_at) VALUES (?, ?, ?, 'error', ?, ?, ?, ?)",
      ).bind(
        Date.now(),
        context.businessId,
        context.userId,
        clean(body.source, 80) || "client",
        message,
        clean(body.route, 200),
        timestamp,
      ).run();
      return Response.json({ ok: true });
    }
    if (action === "feedback") {
      const category = clean(body.category, 40);
      const message = clean(body.message, 1200);
      const rating = Number(body.rating);
      if (!["experience", "inventory", "reservations", "network", "other"].includes(category)) {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }
      if (!Number.isSafeInteger(rating) || rating < 1 || rating > 5 || message.length < 10) {
        return Response.json({ error: "Rating and a message of at least 10 characters are required" }, { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO beta_feedback (id, business_id, user_id, category, rating, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'New', ?)",
      ).bind(Date.now(), context.businessId, context.userId, category, rating, message, timestamp).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return Response.json({ error: "Unable to record the operational event" }, { status: 500 });
  }
}
