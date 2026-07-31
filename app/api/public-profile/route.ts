import { env } from "cloudflare:workers";
import { escapeEmailHtml, sendTransactionalEmail } from "../../email";
import {
  loadPublicProfile,
  normalizePublicHandle,
  publicAvatarUrl,
} from "../../public-profile";
import { sendPushToUsers } from "../../web-push";

type EnquiryBody = {
  handle?: string;
  name?: string;
  email?: string;
  phone?: string;
  eventDate?: string;
  message?: string;
  company?: string;
};

function clean(value: unknown, max: number) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

async function hashSource(request: Request) {
  const source =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("user-agent") ||
    "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const handle = normalizePublicHandle(new URL(request.url).searchParams.get("handle") || "");
  const profile = await loadPublicProfile(handle);
  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
  return Response.json({
    ...profile,
    businessId: undefined,
    avatarUrl: publicAvatarUrl(profile),
    acceptsEnquiries: Boolean(profile.acceptsEnquiries),
  }, { headers: { "cache-control": "public, max-age=60" } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as EnquiryBody;
    if (clean(body.company, 120)) {
      return Response.json({ ok: true });
    }
    const profile = await loadPublicProfile(clean(body.handle, 60));
    if (!profile || !profile.acceptsEnquiries) {
      return Response.json({ error: "Enquiries are unavailable" }, { status: 404 });
    }
    const name = clean(body.name, 120);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 80);
    const eventDate = clean(body.eventDate, 10);
    const message = clean(body.message, 1500);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
      return Response.json({ error: "Name, valid email, and message are required" }, { status: 400 });
    }
    if (eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(`${eventDate}T00:00:00Z`)))) {
      return Response.json({ error: "Event date is invalid" }, { status: 400 });
    }
    const ipHash = await hashSource(request);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM public_enquiries WHERE business_id = ? AND ip_hash = ? AND created_at >= ?",
    ).bind(profile.businessId, ipHash, since).first<{ count: number }>();
    if ((recent?.count || 0) >= 5) {
      return Response.json({ error: "Too many enquiries. Please try again later." }, { status: 429 });
    }
    const createdAt = new Date().toISOString();
    const enquiryId = Date.now() * 1000 + crypto.getRandomValues(new Uint16Array(1))[0];
    await env.DB.prepare(
      "INSERT INTO public_enquiries (id, business_id, name, email, phone, event_date, message, status, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)",
    ).bind(enquiryId, profile.businessId, name, email, phone, eventDate, message, ipHash, createdAt).run();

    const members = await env.DB.prepare(
      "SELECT user_id AS userId FROM memberships WHERE business_id = ? AND status = 'Active'",
    ).bind(profile.businessId).all<{ userId: number }>();
    if (members.results.length) {
      await env.DB.batch(members.results.map((member) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO notifications (business_id, user_id, type, title_pt, title_en, body_pt, body_en, link, source_key, created_at) VALUES (?, ?, 'enquiry', 'Novo pedido público', 'New public enquiry', ?, ?, '', ?, ?)",
        ).bind(
          profile.businessId,
          member.userId,
          `${name} enviou um pedido através do perfil público.`,
          `${name} sent an enquiry through the public profile.`,
          `public-enquiry:${enquiryId}:${member.userId}`,
          createdAt,
        ),
      ));
      await sendPushToUsers(members.results.map((member) => member.userId), {
        title: "Novo pedido público",
        body: `${name} enviou um pedido a ${profile.businessName}.`,
        url: "/?view=profile",
        tag: `public-enquiry:${enquiryId}`,
      }).catch(() => undefined);
    }

    if (profile.email) {
      const safeName = escapeEmailHtml(name);
      const safeMessage = escapeEmailHtml(message).replace(/\n/g, "<br>");
      await sendTransactionalEmail({
        businessId: profile.businessId,
        recipient: profile.email,
        template: "public-enquiry",
        subject: `Novo pedido no perfil público · ${name}`,
        replyTo: email,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#262824"><p style="color:${profile.color};font-weight:700;letter-spacing:2px">TROVE</p><h1 style="font-family:Georgia,serif;font-weight:400">Novo pedido público</h1><p><strong>${safeName}</strong> enviou uma mensagem para ${escapeEmailHtml(profile.businessName)}.</p><p>${safeMessage}</p><p>Email: ${escapeEmailHtml(email)}${phone ? `<br>Telefone: ${escapeEmailHtml(phone)}` : ""}${eventDate ? `<br>Data do evento: ${escapeEmailHtml(eventDate)}` : ""}</p></div>`,
        text: `${name} enviou um pedido para ${profile.businessName}.\n\n${message}\n\nEmail: ${email}${phone ? `\nTelefone: ${phone}` : ""}${eventDate ? `\nData do evento: ${eventDate}` : ""}`,
      });
    }
    return Response.json({ ok: true, enquiryId }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to send the enquiry" }, { status: 500 });
  }
}
