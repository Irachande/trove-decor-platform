import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Image is required" }, { status: 400 });
  }
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5_000_000) {
    return Response.json({ error: "Use a JPG or PNG under 5 MB" }, { status: 400 });
  }
  const key = `profiles/terra-and-table-${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
  await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return Response.json({ url: `/api/profile-image?key=${encodeURIComponent(key)}` });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !key.startsWith("profiles/")) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
