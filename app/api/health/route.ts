import { env } from "cloudflare:workers";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    await env.DB.prepare("SELECT 1 AS healthy").first();
    return Response.json(
      { status: "ok", database: "available", checkedAt },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unavailable", checkedAt },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
