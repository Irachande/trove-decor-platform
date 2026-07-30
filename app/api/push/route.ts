import { env } from "cloudflare:workers";
import { authorize, isAuthorizationResponse } from "../../workspace";
import { sendPushToUsers, webPushConfiguration } from "../../web-push";

type PushBody = {
  action?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function validBase64Url(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);
}

export async function GET(request: Request) {
  const context = await authorize(request);
  if (isAuthorizationResponse(context)) return context;
  const config = webPushConfiguration();
  const subscription = await env.DB.prepare(
    "SELECT id FROM push_subscriptions WHERE business_id = ? AND user_id = ? AND enabled = 1 LIMIT 1",
  ).bind(context.businessId, context.userId).first();
  return Response.json({
    configured: Boolean(config.publicKey && config.privateKey && config.subject),
    publicKey: config.publicKey,
    subscribed: Boolean(subscription),
  });
}

export async function POST(request: Request) {
  try {
    const context = await authorize(request);
    if (isAuthorizationResponse(context)) return context;
    const body = await request.json() as PushBody;
    const action = String(body.action || "");
    const timestamp = new Date().toISOString();

    if (action === "subscribe") {
      const endpoint = String(body.endpoint || "").trim();
      const p256dh = String(body.keys?.p256dh || "").trim();
      const auth = String(body.keys?.auth || "").trim();
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1500) {
        return Response.json({ error: "Invalid push endpoint" }, { status: 400 });
      }
      if (!validBase64Url(p256dh, 80, 120) || !validBase64Url(auth, 16, 64)) {
        return Response.json({ error: "Invalid push keys" }, { status: 400 });
      }
      await env.DB.prepare(
        `INSERT INTO push_subscriptions
          (id, business_id, user_id, endpoint, p256dh, auth, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
          business_id = excluded.business_id,
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          enabled = 1,
          updated_at = excluded.updated_at`,
      ).bind(Date.now(), context.businessId, context.userId, endpoint, p256dh, auth, timestamp, timestamp).run();
      return Response.json({ ok: true, subscribed: true });
    }

    if (action === "unsubscribe") {
      const endpoint = String(body.endpoint || "").trim();
      await env.DB.prepare(
        "DELETE FROM push_subscriptions WHERE endpoint = ? AND business_id = ? AND user_id = ?",
      ).bind(endpoint, context.businessId, context.userId).run();
      return Response.json({ ok: true, subscribed: false });
    }

    if (action === "test") {
      const result = await sendPushToUsers([context.userId], {
        title: "Trove",
        body: "As notificações em segundo plano estão activas.",
        url: "/",
        tag: "trove-push-test",
      });
      if (!result.delivered) {
        return Response.json(
          { error: result.failed ? "Push delivery failed" : "No active push subscription" },
          { status: 502 },
        );
      }
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update push settings" },
      { status: 500 },
    );
  }
}
