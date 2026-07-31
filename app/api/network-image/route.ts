import { env } from "cloudflare:workers";
import { authorize, isAuthorizationResponse } from "../../workspace";

export async function GET(request: Request) {
  const context = await authorize(request);
  if (isAuthorizationResponse(context)) return context;
  if (
    context.plan !== "Network" ||
    ["PastDue", "Cancelled"].includes(context.subscriptionStatus)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const listingId = Number(new URL(request.url).searchParams.get("listing"));
  if (!Number.isSafeInteger(listingId) || listingId <= 0) {
    return new Response("Not found", { status: 404 });
  }
  const listing = await env.DB.prepare(
    `SELECT listing.business_id AS businessId, item.photo_url AS photoUrl
    FROM marketplace_listings AS listing
    JOIN inventory_items AS item
      ON item.id = listing.item_id
     AND item.business_id = listing.business_id
    JOIN subscriptions AS subscription
      ON subscription.business_id = listing.business_id
     AND subscription.status IN ('Trialing', 'Active', 'Grace')
    WHERE listing.id = ? AND listing.active = 1`,
  ).bind(listingId).first<{ businessId: number; photoUrl: string | null }>();
  if (!listing?.photoUrl) return new Response("Not found", { status: 404 });
  const key = new URL(listing.photoUrl, "https://trove.local").searchParams.get("key");
  const allowedPrefix = `businesses/${listing.businessId}/items/`;
  const allowedLegacy = listing.businessId === 1 && key?.startsWith("items/");
  if (!key || (!key.startsWith(allowedPrefix) && !allowedLegacy)) {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=300");
  return new Response(object.body, { headers });
}
