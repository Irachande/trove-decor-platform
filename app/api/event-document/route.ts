import { env } from "cloudflare:workers";
import {
  authorize,
  isAuthorizationResponse,
} from "../../workspace";

const MAX_FILE_SIZE = 10_000_000;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ALLOWED_CATEGORIES = new Set([
  "Contract",
  "Quote",
  "FloorPlan",
  "Invoice",
  "Inspiration",
  "Other",
]);

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "document";
}

function contentDisposition(name: string) {
  const fallback = safeName(name).replace(/"/g, "");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

async function audit(
  businessId: number,
  userId: number,
  action: string,
  documentId: string,
  summary: string,
) {
  await env.DB.prepare(
    "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, 'event_document', ?, ?, ?)",
  ).bind(
    businessId,
    userId,
    action,
    documentId,
    summary,
    new Date().toISOString(),
  ).run();
}

export async function POST(request: Request) {
  const context = await authorize(request, "manageReservations");
  if (isAuthorizationResponse(context)) return context;
  const form = await request.formData();
  const file = form.get("file");
  const eventId = Number(form.get("eventId"));
  const category = String(form.get("category") || "Other");
  const notes = String(form.get("notes") || "").trim();
  if (!(file instanceof File)) {
    return Response.json({ error: "Document is required" }, { status: 400 });
  }
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    return Response.json({ error: "Event is invalid" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: "Use PDF, JPG, PNG, DOCX or XLSX files under 10 MB" },
      { status: 400 },
    );
  }
  if (!ALLOWED_CATEGORIES.has(category) || notes.length > 1000) {
    return Response.json({ error: "Document details are invalid" }, { status: 400 });
  }
  const event = await env.DB.prepare(
    "SELECT status FROM events WHERE id = ? AND business_id = ?",
  ).bind(eventId, context.businessId).first<{ status: string }>();
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });
  if (event.status === "Archived") {
    return Response.json({ error: "Archived events cannot be changed" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const key = `businesses/${context.businessId}/events/${eventId}/documents/${id}-${safeName(file.name)}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: contentDisposition(file.name),
    },
    customMetadata: {
      businessId: String(context.businessId),
      eventId: String(eventId),
    },
  });
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO event_documents (id, business_id, event_id, name, object_key, content_type, size, category, notes, uploaded_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        id,
        context.businessId,
        eventId,
        file.name.slice(0, 240),
        key,
        file.type,
        file.size,
        category,
        notes,
        context.userId,
        createdAt,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, 'addEventDocument', 'event_document', ?, 'Documento de evento carregado', ?)",
      ).bind(context.businessId, context.userId, id, createdAt),
    ]);
  } catch (error) {
    await env.MEDIA.delete(key);
    throw error;
  }
  return Response.json({ ok: true, documentId: id });
}

export async function GET(request: Request) {
  const context = await authorize(request);
  if (isAuthorizationResponse(context)) return context;
  const id = new URL(request.url).searchParams.get("id") || "";
  const document = await env.DB.prepare(
    "SELECT name, object_key AS objectKey, content_type AS contentType FROM event_documents WHERE id = ? AND business_id = ?",
  ).bind(id, context.businessId).first<{
    name: string;
    objectKey: string;
    contentType: string;
  }>();
  if (!document) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(document.objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", document.contentType);
  headers.set("content-disposition", contentDisposition(document.name));
  headers.set("cache-control", "private, no-store");
  return new Response(object.body, { headers });
}

export async function DELETE(request: Request) {
  const context = await authorize(request, "manageReservations");
  if (isAuthorizationResponse(context)) return context;
  const id = new URL(request.url).searchParams.get("id") || "";
  const document = await env.DB.prepare(
    "SELECT d.object_key AS objectKey, e.status AS eventStatus FROM event_documents d JOIN events e ON e.id = d.event_id AND e.business_id = d.business_id WHERE d.id = ? AND d.business_id = ?",
  ).bind(id, context.businessId).first<{
    objectKey: string;
    eventStatus: string;
  }>();
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
  if (document.eventStatus === "Archived") {
    return Response.json({ error: "Archived events cannot be changed" }, { status: 400 });
  }
  await env.MEDIA.delete(document.objectKey);
  await env.DB.prepare(
    "DELETE FROM event_documents WHERE id = ? AND business_id = ?",
  ).bind(id, context.businessId).run();
  await audit(
    context.businessId,
    context.userId,
    "deleteEventDocument",
    id,
    "Documento de evento removido",
  );
  return Response.json({ ok: true });
}
