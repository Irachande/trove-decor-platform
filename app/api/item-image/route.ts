import { env } from "cloudflare:workers";
import {
  authorize,
  isAuthorizationResponse,
} from "../../workspace";

export async function POST(request: Request) {
  const context = await authorize(request, "manageInventory");
  if (isAuthorizationResponse(context)) return context;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Image is required" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5_000_000) {
    return Response.json({ error: "Use a JPG or PNG under 5 MB" }, { status: 400 });
  }
  const key = `businesses/${context.businessId}/items/item-${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "jpg"}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return Response.json({ url: `/api/item-image?key=${encodeURIComponent(key)}` });
}

export async function GET(request: Request) {
  const context = await authorize(request);
  if (isAuthorizationResponse(context)) return context;
  const key = new URL(request.url).searchParams.get("key");
  const ownPrefix = `businesses/${context.businessId}/items/`;
  const allowedLegacy = context.businessId === 1 && key?.startsWith("items/");
  if (!key || (!key.startsWith(ownPrefix) && !allowedLegacy)) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
