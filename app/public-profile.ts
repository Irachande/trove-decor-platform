import { env } from "cloudflare:workers";
import { ensureWorkspaceDatabase } from "./workspace";

export type PublicProfileRecord = {
  businessId: number;
  businessName: string;
  handle: string;
  bio: string;
  location: string;
  phone: string;
  email: string;
  color: string;
  avatarUrl: string | null;
  website: string;
  instagram: string;
  services: string;
  acceptsEnquiries: number;
  plan: string;
  itemCount: number;
  rating: number;
  ratingCount: number;
};

export function normalizePublicHandle(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
}

export async function loadPublicProfile(handle: string) {
  await ensureWorkspaceDatabase();
  const normalized = normalizePublicHandle(handle);
  if (!normalized) return null;
  const profile = await env.DB.prepare(
    `SELECT
      p.business_id AS businessId,
      p.business_name AS businessName,
      p.handle,
      p.bio,
      p.location,
      p.phone,
      p.email,
      p.color,
      p.avatar_url AS avatarUrl,
      p.website,
      p.instagram,
      p.services,
      p.accepts_enquiries AS acceptsEnquiries,
      b.plan,
      COALESCE((SELECT SUM(quantity) FROM inventory_items WHERE business_id = p.business_id), 0) AS itemCount,
      COALESCE((SELECT ROUND(AVG(rating), 1) FROM rental_reviews WHERE reviewed_business_id = p.business_id), 0) AS rating,
      COALESCE((SELECT COUNT(*) FROM rental_reviews WHERE reviewed_business_id = p.business_id), 0) AS ratingCount
    FROM business_profile p
    JOIN businesses b ON b.id = p.business_id
    WHERE p.handle = ? AND p.is_public = 1
    LIMIT 1`,
  ).bind(normalized).first<PublicProfileRecord>();
  return profile || null;
}

export function publicAvatarUrl(profile: PublicProfileRecord) {
  return profile.avatarUrl
    ? `/api/public-profile-image?handle=${encodeURIComponent(profile.handle)}`
    : null;
}
