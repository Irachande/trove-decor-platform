import { env } from "cloudflare:workers";
import { loadPublicProfile } from "../../public-profile";

export async function GET(request: Request) {
  const handle = new URL(request.url).searchParams.get("handle") || "";
  const profile = await loadPublicProfile(handle);
  if (!profile?.avatarUrl) return new Response("Not found", { status: 404 });
  const key = new URL(profile.avatarUrl, "https://trove.local").searchParams.get("key");
  const allowedPrefix = `businesses/${profile.businessId}/profiles/`;
  const allowedLegacy = profile.businessId === 1 && key?.startsWith("profiles/");
  if (!key || (!key.startsWith(allowedPrefix) && !allowedLegacy)) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
