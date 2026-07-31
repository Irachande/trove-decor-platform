import { env } from "cloudflare:workers";
import {
  authorize,
  isAuthorizationResponse,
  type WorkspaceContext,
  type WorkspacePermission,
} from "../../workspace";

type Payload = Record<string, unknown>;
type RentalRequestRow = {
  id: number;
  listingId: number;
  ownerBusinessId: number;
  requesterBusinessId: number;
  quantity: number;
  startDate: string;
  endDate: string;
  status: string;
  unitPrice: number;
  deposit: number;
  total: number;
  currency: string;
  proposedByBusinessId: number | null;
  paymentStatus: string;
  depositStatus: string;
  checkedOutAt: string | null;
  returnedAt: string | null;
};

const ACTION_PERMISSIONS: Record<string, WorkspacePermission> = {
  publishListing: "manageNetworkListings",
  setListingActive: "manageNetworkListings",
  createRentalRequest: "manageNetworkRentals",
  counterRentalRequest: "manageNetworkRentals",
  acceptRentalRequest: "manageNetworkRentals",
  rejectRentalRequest: "manageNetworkRentals",
  cancelRentalRequest: "manageNetworkRentals",
  updateRentalFinancials: "manageNetworkRentals",
  transitionRentalRequest: "manageNetworkRentals",
  reviewRental: "manageNetworkRentals",
  openRentalDispute: "manageNetworkRentals",
  proposeDisputeResolution: "manageNetworkRentals",
  acceptDisputeResolution: "manageNetworkRentals",
};

function text(
  payload: Payload,
  key: string,
  options: { required?: boolean; max?: number } = {},
) {
  const value = String(payload[key] ?? "").trim();
  if (options.required && !value) throw new Error(`${key} is required`);
  if (value.length > (options.max ?? 500)) throw new Error(`${key} is too long`);
  return value;
}

function integer(
  payload: Payload,
  key: string,
  options: { min?: number; max?: number } = {},
) {
  const value = Number(payload[key]);
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be an integer`);
  if (value < (options.min ?? Number.MIN_SAFE_INTEGER)) throw new Error(`${key} is too small`);
  if (value > (options.max ?? Number.MAX_SAFE_INTEGER)) throw new Error(`${key} is too large`);
  return value;
}

function date(payload: Payload, key: string) {
  const value = text(payload, key, { required: true, max: 10 });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new Error(`${key} is invalid`);
  }
  return value;
}

function optionalCoordinate(payload: Payload, key: string, min: number, max: number) {
  const raw = String(payload[key] ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} is invalid`);
  }
  return String(value);
}

function rentalDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (end < start) throw new Error("endDate is invalid");
  return Math.floor((end - start) / 86_400_000) + 1;
}

function distanceKm(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(toLatitude - fromLatitude);
  const deltaLongitude = radians(toLongitude - fromLongitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clientError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Invalid network request";
  const message = raw.includes("INSUFFICIENT_NETWORK_AVAILABILITY")
    ? "The item is no longer available for the selected dates"
    : raw.includes("INSUFFICIENT_NETWORK_PHYSICAL_STOCK")
      ? "There is not enough physical stock for collection"
      : raw;
  const validation =
    /required|invalid|too long|too small|too large|must be|not found|not available|not enough|cannot|only|already|different business|plan/i.test(
      message,
    );
  return Response.json({ error: message }, { status: validation ? 400 : 500 });
}

async function networkContext(
  request: Request,
  permission: WorkspacePermission = "read",
) {
  const context = await authorize(request, permission);
  if (isAuthorizationResponse(context)) return context;
  if (context.plan !== "Network") {
    return Response.json(
      { error: "The Network plan is required", code: "NETWORK_PLAN_REQUIRED" },
      { status: 403 },
    );
  }
  if (["PastDue", "Cancelled"].includes(context.subscriptionStatus)) {
    return Response.json(
      { error: "An active Network subscription is required", code: "SUBSCRIPTION_REQUIRED" },
      { status: 402 },
    );
  }
  return context;
}

async function listingAvailability(
  listingId: number,
  startDate: string,
  endDate: string,
  excludingRequestId = 0,
) {
  const result = await env.DB.prepare(
    `SELECT MAX(0, stock.quantity
      - COALESCE((
        SELECT SUM(line.quantity)
        FROM reservation_items AS line
        JOIN reservations AS reservation
          ON reservation.id = line.reservation_id
         AND reservation.business_id = line.business_id
        WHERE line.business_id = listing.business_id
          AND line.item_id = listing.item_id
          AND reservation.status NOT IN ('Cancelled', 'Returned')
          AND reservation.date <= ?
          AND reservation.end_date >= ?
      ), 0)
      - COALESCE((
        SELECT SUM(requested.quantity)
        FROM rental_requests AS requested
        WHERE requested.listing_id = listing.id
          AND requested.id != ?
          AND requested.status IN ('Accepted', 'CheckedOut', 'Disputed')
          AND requested.start_date <= ?
          AND requested.end_date >= ?
      ), 0)) AS available
    FROM marketplace_listings AS listing
    JOIN inventory_items AS stock
      ON stock.id = listing.item_id
     AND stock.business_id = listing.business_id
    WHERE listing.id = ? AND listing.active = 1`,
  ).bind(endDate, startDate, excludingRequestId, endDate, startDate, listingId)
    .first<{ available: number }>();
  return Number(result?.available ?? 0);
}

async function getRentalRequest(id: number) {
  return env.DB.prepare(
    `SELECT id, listing_id AS listingId, owner_business_id AS ownerBusinessId,
      requester_business_id AS requesterBusinessId, quantity,
      start_date AS startDate, end_date AS endDate, status,
      unit_price AS unitPrice, deposit, total, currency,
      proposed_by_business_id AS proposedByBusinessId,
      payment_status AS paymentStatus, deposit_status AS depositStatus,
      checked_out_at AS checkedOutAt, returned_at AS returnedAt
    FROM rental_requests WHERE id = ?`,
  ).bind(id).first<RentalRequestRow>();
}

function assertParticipant(context: WorkspaceContext, request: RentalRequestRow) {
  if (
    ![request.ownerBusinessId, request.requesterBusinessId].includes(
      context.businessId,
    )
  ) {
    throw new Error("Rental request not found");
  }
}

async function notifyBusiness(
  businessId: number,
  titlePt: string,
  titleEn: string,
  bodyPt: string,
  bodyEn: string,
  sourceKey: string,
  createdAt: string,
) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notifications (
      business_id, user_id, type, title_pt, title_en, body_pt, body_en,
      link, source_key, created_at
    )
    SELECT ?, user_id, 'network', ?, ?, ?, ?, '', ? || ':' || user_id, ?
    FROM memberships WHERE business_id = ? AND status = 'Active'`,
  ).bind(
    businessId,
    titlePt,
    titleEn,
    bodyPt,
    bodyEn,
    sourceKey,
    createdAt,
    businessId,
  ).run();
}

async function audit(
  businessId: number,
  userId: number,
  action: string,
  entityId: number,
  summary: string,
  createdAt: string,
) {
  await env.DB.prepare(
    "INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, 'rental_request', ?, ?, ?)",
  ).bind(businessId, userId, action, String(entityId), summary, createdAt).run();
}

async function notifyBoth(
  request: RentalRequestRow,
  titlePt: string,
  titleEn: string,
  bodyPt: string,
  bodyEn: string,
  sourceKey: string,
  createdAt: string,
) {
  await Promise.all([
    notifyBusiness(
      request.ownerBusinessId,
      titlePt,
      titleEn,
      bodyPt,
      bodyEn,
      sourceKey,
      createdAt,
    ),
    notifyBusiness(
      request.requesterBusinessId,
      titlePt,
      titleEn,
      bodyPt,
      bodyEn,
      sourceKey,
      createdAt,
    ),
  ]);
}

export async function GET(request: Request) {
  try {
    const context = await networkContext(request);
    if (isAuthorizationResponse(context)) return context;
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
    const today = new Date().toISOString().slice(0, 10);
    const startDate = url.searchParams.get("start") || today;
    const endDate = url.searchParams.get("end") || startDate;
    rentalDays(startDate, endDate);
    const requestedQuantity = Math.max(1, Math.min(100_000, Number(url.searchParams.get("quantity") || 1)));
    const maximumPriceValue = Number(url.searchParams.get("maxPrice") || 0);
    const maximumPrice = Number.isFinite(maximumPriceValue) && maximumPriceValue > 0
      ? Math.min(100_000_000, maximumPriceValue)
      : null;
    const latitudeParam = url.searchParams.get("latitude");
    const longitudeParam = url.searchParams.get("longitude");
    const originLatitude = Number(latitudeParam);
    const originLongitude = Number(longitudeParam);
    const maximumDistance = Math.max(1, Math.min(500, Number(url.searchParams.get("distance") || 50)));

    const [catalog, ownListings, requests, reviews] = await Promise.all([
      env.DB.prepare(
        `SELECT listing.id, listing.business_id AS ownerBusinessId,
          listing.item_id AS itemId, stock.name, stock.category,
          stock.description, stock.tone, stock.symbol,
          listing.daily_price AS dailyPrice, listing.deposit, listing.currency,
          listing.minimum_quantity AS minimumQuantity,
          listing.maximum_quantity AS maximumQuantity,
          listing.location, listing.latitude, listing.longitude,
          listing.delivery_options AS deliveryOptions, listing.terms,
          owner.name AS ownerName, owner.handle AS ownerHandle,
          CASE WHEN stock.photo_url IS NULL OR stock.photo_url = '' THEN 0 ELSE 1 END AS hasPhoto,
          COALESCE((SELECT ROUND(AVG(rating), 1) FROM rental_reviews WHERE reviewed_business_id = listing.business_id), 0) AS rating,
          (SELECT COUNT(*) FROM rental_reviews WHERE reviewed_business_id = listing.business_id) AS ratingCount,
          MAX(0, stock.quantity
            - COALESCE((
              SELECT SUM(line.quantity)
              FROM reservation_items AS line
              JOIN reservations AS reservation
                ON reservation.id = line.reservation_id
               AND reservation.business_id = line.business_id
              WHERE line.business_id = listing.business_id
                AND line.item_id = listing.item_id
                AND reservation.status NOT IN ('Cancelled', 'Returned')
                AND reservation.date <= ?
                AND reservation.end_date >= ?
            ), 0)
            - COALESCE((
              SELECT SUM(network.quantity)
              FROM rental_requests AS network
              WHERE network.listing_id = listing.id
                AND network.status IN ('Accepted', 'CheckedOut', 'Disputed')
                AND network.start_date <= ?
                AND network.end_date >= ?
            ), 0)) AS available
        FROM marketplace_listings AS listing
        JOIN inventory_items AS stock
          ON stock.id = listing.item_id
         AND stock.business_id = listing.business_id
        JOIN businesses AS owner ON owner.id = listing.business_id
        JOIN subscriptions AS subscription ON subscription.business_id = listing.business_id
        WHERE listing.active = 1
          AND listing.business_id != ?
          AND owner.plan = 'Network'
          AND subscription.status IN ('Trialing', 'Active', 'Grace')
        ORDER BY listing.updated_at DESC LIMIT 300`,
      ).bind(endDate, startDate, endDate, startDate, context.businessId).all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT listing.id, listing.item_id AS itemId, stock.name,
          stock.category, stock.quantity, listing.daily_price AS dailyPrice,
          listing.deposit, listing.currency,
          listing.minimum_quantity AS minimumQuantity,
          listing.maximum_quantity AS maximumQuantity, listing.location,
          listing.latitude, listing.longitude,
          listing.delivery_options AS deliveryOptions, listing.terms,
          listing.active, listing.created_at AS createdAt,
          listing.updated_at AS updatedAt
        FROM marketplace_listings AS listing
        JOIN inventory_items AS stock
          ON stock.id = listing.item_id
         AND stock.business_id = listing.business_id
        WHERE listing.business_id = ? ORDER BY listing.updated_at DESC`,
      ).bind(context.businessId).all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT request.id, request.listing_id AS listingId,
          request.owner_business_id AS ownerBusinessId,
          request.requester_business_id AS requesterBusinessId,
          request.quantity, request.start_date AS startDate,
          request.end_date AS endDate, request.status,
          request.unit_price AS unitPrice, request.deposit, request.total,
          request.currency, request.requester_note AS requesterNote,
          request.owner_note AS ownerNote,
          request.delivery_method AS deliveryMethod,
          request.proposed_by_business_id AS proposedByBusinessId,
          request.payment_status AS paymentStatus,
          request.deposit_status AS depositStatus,
          request.checked_out_at AS checkedOutAt,
          request.returned_at AS returnedAt,
          request.cancelled_at AS cancelledAt,
          request.created_at AS createdAt, request.updated_at AS updatedAt,
          stock.item_id AS itemId, item.name AS itemName,
          owner.name AS ownerName, requester.name AS requesterName,
          dispute.id AS disputeId, dispute.opened_by_business_id AS disputeOpenedByBusinessId,
          dispute.reason AS disputeReason, dispute.status AS disputeStatus,
          dispute.proposed_resolution AS proposedResolution,
          dispute.proposed_by_business_id AS resolutionProposedByBusinessId,
          review.id AS reviewId, review.rating AS myRating,
          review.comment AS myReview
        FROM rental_requests AS request
        JOIN marketplace_listings AS stock ON stock.id = request.listing_id
        JOIN inventory_items AS item
          ON item.id = stock.item_id
         AND item.business_id = stock.business_id
        JOIN businesses AS owner ON owner.id = request.owner_business_id
        JOIN businesses AS requester ON requester.id = request.requester_business_id
        LEFT JOIN rental_disputes AS dispute ON dispute.rental_request_id = request.id
        LEFT JOIN rental_reviews AS review
          ON review.rental_request_id = request.id
         AND review.reviewer_business_id = ?
        WHERE request.owner_business_id = ? OR request.requester_business_id = ?
        ORDER BY request.updated_at DESC LIMIT 200`,
      ).bind(context.businessId, context.businessId, context.businessId)
        .all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT review.id, review.rental_request_id AS rentalRequestId,
          review.reviewer_business_id AS reviewerBusinessId,
          review.reviewed_business_id AS reviewedBusinessId,
          reviewer.name AS reviewerName, review.rating, review.comment,
          review.created_at AS createdAt
        FROM rental_reviews AS review
        JOIN businesses AS reviewer ON reviewer.id = review.reviewer_business_id
        WHERE review.reviewed_business_id = ? OR review.reviewer_business_id = ?
        ORDER BY review.created_at DESC LIMIT 200`,
      ).bind(context.businessId, context.businessId).all(),
    ]);

    const hasOrigin =
      latitudeParam !== null &&
      longitudeParam !== null &&
      Number.isFinite(originLatitude) &&
      Number.isFinite(originLongitude);
    const listings = catalog.results
      .map((entry) => {
        const latitude = Number(entry.latitude);
        const longitude = Number(entry.longitude);
        const distance = hasOrigin && Number.isFinite(latitude) && Number.isFinite(longitude)
          ? distanceKm(originLatitude, originLongitude, latitude, longitude)
          : null;
        return {
          ...entry,
          available: Number(entry.available),
          hasPhoto: Boolean(entry.hasPhoto),
          imageUrl: entry.hasPhoto ? `/api/network-image?listing=${entry.id}` : "",
          distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
        };
      })
      .filter((entry) => {
        const values = entry as Record<string, unknown> & {
          available: number;
          distanceKm: number | null;
        };
        const haystack = `${String(values.name || "")} ${String(values.category || "")} ${String(values.ownerName || "")} ${String(values.location || "")}`.toLowerCase();
        return (
          Number(values.available) >= requestedQuantity &&
          (maximumPrice === null || Number(values.dailyPrice) <= maximumPrice) &&
          (!query || haystack.includes(query)) &&
          (values.distanceKm === null || values.distanceKm <= maximumDistance)
        );
      });

    return Response.json({
      listings,
      ownListings: ownListings.results.map((entry) => ({
        ...entry,
        active: Boolean(entry.active),
      })),
      requests: requests.results,
      reviews: reviews.results,
      search: { startDate, endDate, quantity: requestedQuantity, maximumPrice, maximumDistance },
      workspace: { businessId: context.businessId, plan: context.plan },
    });
  } catch (error) {
    return clientError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; payload?: Payload };
    const action = String(body.action || "");
    const payload = body.payload || {};
    const permission = ACTION_PERMISSIONS[action];
    if (!permission) return Response.json({ error: "Unknown action" }, { status: 400 });
    const context = await networkContext(request, permission);
    if (isAuthorizationResponse(context)) return context;
    const createdAt = new Date().toISOString();
    let requestForNotification: RentalRequestRow | null = null;
    let result: Record<string, unknown> = { ok: true };

    if (action === "publishListing") {
      const itemId = integer(payload, "itemId", { min: 1 });
      const item = await env.DB.prepare(
        "SELECT id, quantity, price, currency FROM inventory_items WHERE id = ? AND business_id = ?",
      ).bind(itemId, context.businessId).first<{
        id: number;
        quantity: number;
        price: number;
        currency: string;
      }>();
      if (!item) throw new Error("Inventory item not found");
      const minimumQuantity = integer(payload, "minimumQuantity", { min: 1, max: item.quantity });
      const maximumQuantity = integer(payload, "maximumQuantity", { min: minimumQuantity, max: item.quantity });
      const dailyPrice = integer(payload, "dailyPrice", { min: 1, max: 100_000_000 });
      const deposit = integer(payload, "deposit", { min: 0, max: 100_000_000 });
      const location = text(payload, "location", { required: true, max: 160 });
      const latitude = optionalCoordinate(payload, "latitude", -90, 90);
      const longitude = optionalCoordinate(payload, "longitude", -180, 180);
      const listingId = integer(payload, "id", { min: 1 });
      await env.DB.prepare(
        `INSERT INTO marketplace_listings (
          id, business_id, item_id, daily_price, deposit, currency,
          minimum_quantity, maximum_quantity, location, latitude, longitude,
          delivery_options, terms, active, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'MZN', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(business_id, item_id) DO UPDATE SET
          daily_price = excluded.daily_price,
          deposit = excluded.deposit,
          currency = 'MZN',
          minimum_quantity = excluded.minimum_quantity,
          maximum_quantity = excluded.maximum_quantity,
          location = excluded.location,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          delivery_options = excluded.delivery_options,
          terms = excluded.terms,
          active = 1,
          updated_at = excluded.updated_at`,
      ).bind(
        listingId,
        context.businessId,
        itemId,
        dailyPrice,
        deposit,
        minimumQuantity,
        maximumQuantity,
        location,
        latitude,
        longitude,
        text(payload, "deliveryOptions", { required: true, max: 80 }),
        text(payload, "terms", { max: 2000 }),
        context.userId,
        createdAt,
        createdAt,
      ).run();
      result = { ok: true, listingId };
      await audit(context.businessId, context.userId, action, listingId, "Artigo publicado na Trove Network", createdAt);
    } else if (action === "setListingActive") {
      const listingId = integer(payload, "id", { min: 1 });
      const active = Boolean(payload.active);
      const updated = await env.DB.prepare(
        "UPDATE marketplace_listings SET active = ?, updated_at = ? WHERE id = ? AND business_id = ?",
      ).bind(active ? 1 : 0, createdAt, listingId, context.businessId).run();
      if (!updated.meta.changes) throw new Error("Listing not found");
      await audit(
        context.businessId,
        context.userId,
        action,
        listingId,
        active ? "Publicação reactivada" : "Publicação pausada",
        createdAt,
      );
    } else if (action === "createRentalRequest") {
      const listingId = integer(payload, "listingId", { min: 1 });
      const listing = await env.DB.prepare(
        `SELECT listing.id, listing.business_id AS ownerBusinessId,
          listing.daily_price AS dailyPrice, listing.deposit,
          listing.minimum_quantity AS minimumQuantity,
          listing.maximum_quantity AS maximumQuantity, listing.active,
          owner.plan
        FROM marketplace_listings AS listing
        JOIN businesses AS owner ON owner.id = listing.business_id
        WHERE listing.id = ?`,
      ).bind(listingId).first<{
        id: number;
        ownerBusinessId: number;
        dailyPrice: number;
        deposit: number;
        minimumQuantity: number;
        maximumQuantity: number;
        active: number;
        plan: string;
      }>();
      if (!listing?.active || listing.plan !== "Network") throw new Error("Listing not found");
      if (listing.ownerBusinessId === context.businessId) throw new Error("Request a listing from a different business");
      const quantity = integer(payload, "quantity", {
        min: listing.minimumQuantity,
        max: listing.maximumQuantity,
      });
      const startDate = date(payload, "startDate");
      const endDate = date(payload, "endDate");
      const days = rentalDays(startDate, endDate);
      if (await listingAvailability(listingId, startDate, endDate) < quantity) {
        throw new Error("The item is not available for the selected dates");
      }
      const existing = await env.DB.prepare(
        "SELECT id FROM rental_requests WHERE listing_id = ? AND requester_business_id = ? AND status IN ('Pending', 'Countered', 'Accepted', 'CheckedOut', 'Disputed') AND start_date <= ? AND end_date >= ?",
      ).bind(listingId, context.businessId, endDate, startDate).first();
      if (existing) throw new Error("An active request already exists for these dates");
      const requestId = integer(payload, "id", { min: 1 });
      const total = listing.dailyPrice * quantity * days;
      await env.DB.prepare(
        `INSERT INTO rental_requests (
          id, listing_id, owner_business_id, requester_business_id, quantity,
          start_date, end_date, status, unit_price, deposit, total, currency,
          requester_note, owner_note, delivery_method, proposed_by_business_id,
          payment_status, deposit_status, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 'MZN', ?, '', ?,
          ?, 'Pending', 'Pending', ?, ?, ?)`,
      ).bind(
        requestId,
        listingId,
        listing.ownerBusinessId,
        context.businessId,
        quantity,
        startDate,
        endDate,
        listing.dailyPrice,
        listing.deposit,
        total,
        text(payload, "note", { max: 2000 }),
        text(payload, "deliveryMethod", { required: true, max: 80 }),
        context.businessId,
        context.userId,
        createdAt,
        createdAt,
      ).run();
      result = { ok: true, requestId };
      requestForNotification = await getRentalRequest(requestId);
      await audit(context.businessId, context.userId, action, requestId, "Pedido de aluguer enviado", createdAt);
    } else {
      const requestId = integer(payload, "id", { min: 1 });
      const rental = await getRentalRequest(requestId);
      if (!rental) throw new Error("Rental request not found");
      assertParticipant(context, rental);
      requestForNotification = rental;

      if (action === "counterRentalRequest") {
        if (context.businessId !== rental.ownerBusinessId) throw new Error("Only the owner can counter this request");
        if (!["Pending", "Countered"].includes(rental.status)) throw new Error("This request cannot be countered");
        const listing = await env.DB.prepare(
          "SELECT minimum_quantity AS minimumQuantity, maximum_quantity AS maximumQuantity FROM marketplace_listings WHERE id = ? AND business_id = ? AND active = 1",
        ).bind(rental.listingId, rental.ownerBusinessId).first<{
          minimumQuantity: number;
          maximumQuantity: number;
        }>();
        if (!listing) throw new Error("Listing not found");
        const quantity = integer(payload, "quantity", { min: listing.minimumQuantity, max: listing.maximumQuantity });
        const startDate = date(payload, "startDate");
        const endDate = date(payload, "endDate");
        const days = rentalDays(startDate, endDate);
        const unitPrice = integer(payload, "unitPrice", { min: 1, max: 100_000_000 });
        const deposit = integer(payload, "deposit", { min: 0, max: 100_000_000 });
        if (await listingAvailability(rental.listingId, startDate, endDate, rental.id) < quantity) {
          throw new Error("The item is not available for the selected dates");
        }
        await env.DB.prepare(
          `UPDATE rental_requests SET quantity = ?, start_date = ?, end_date = ?,
            status = 'Countered', unit_price = ?, deposit = ?, total = ?,
            owner_note = ?, proposed_by_business_id = ?, updated_at = ?
          WHERE id = ?`,
        ).bind(
          quantity,
          startDate,
          endDate,
          unitPrice,
          deposit,
          unitPrice * quantity * days,
          text(payload, "note", { max: 2000 }),
          context.businessId,
          createdAt,
          rental.id,
        ).run();
      } else if (action === "acceptRentalRequest") {
        const canAccept =
          rental.status === "Pending"
            ? context.businessId === rental.ownerBusinessId
            : rental.status === "Countered" &&
              context.businessId !== rental.proposedByBusinessId;
        if (!canAccept) throw new Error("This business cannot accept the request");
        await env.DB.prepare(
          "UPDATE rental_requests SET status = 'Accepted', updated_at = ? WHERE id = ? AND status IN ('Pending', 'Countered')",
        ).bind(createdAt, rental.id).run();
      } else if (action === "rejectRentalRequest") {
        if (context.businessId !== rental.ownerBusinessId) throw new Error("Only the owner can reject this request");
        if (!["Pending", "Countered"].includes(rental.status)) throw new Error("This request cannot be rejected");
        await env.DB.prepare(
          "UPDATE rental_requests SET status = 'Rejected', owner_note = ?, cancelled_at = ?, updated_at = ? WHERE id = ?",
        ).bind(text(payload, "note", { max: 2000 }), createdAt, createdAt, rental.id).run();
      } else if (action === "cancelRentalRequest") {
        if (context.businessId !== rental.requesterBusinessId) throw new Error("Only the requester can cancel this request");
        if (!["Pending", "Countered", "Accepted"].includes(rental.status)) throw new Error("This request cannot be cancelled");
        await env.DB.prepare(
          "UPDATE rental_requests SET status = 'Cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?",
        ).bind(createdAt, createdAt, rental.id).run();
      } else if (action === "updateRentalFinancials") {
        if (context.businessId !== rental.ownerBusinessId) throw new Error("Only the owner can confirm financial status");
        if (!["Accepted", "CheckedOut", "Returned", "Disputed", "Completed"].includes(rental.status)) {
          throw new Error("Financial status cannot be changed yet");
        }
        const paymentStatus = text(payload, "paymentStatus", { required: true, max: 20 });
        const depositStatus = text(payload, "depositStatus", { required: true, max: 20 });
        if (!["Pending", "Confirmed", "Refunded"].includes(paymentStatus)) throw new Error("paymentStatus is invalid");
        if (!["Pending", "Held", "Returned", "Retained"].includes(depositStatus)) throw new Error("depositStatus is invalid");
        await env.DB.prepare(
          "UPDATE rental_requests SET payment_status = ?, deposit_status = ?, updated_at = ? WHERE id = ?",
        ).bind(paymentStatus, depositStatus, createdAt, rental.id).run();
      } else if (action === "transitionRentalRequest") {
        if (context.businessId !== rental.ownerBusinessId) throw new Error("Only the owner can update delivery");
        const target = text(payload, "status", { required: true, max: 20 });
        const listing = await env.DB.prepare(
          "SELECT item_id AS itemId FROM marketplace_listings WHERE id = ? AND business_id = ?",
        ).bind(rental.listingId, rental.ownerBusinessId).first<{ itemId: number }>();
        if (!listing) throw new Error("Listing not found");
        if (target === "CheckedOut" && rental.status === "Accepted") {
          if (rental.paymentStatus !== "Confirmed") throw new Error("Confirm payment before collection");
          if (rental.deposit > 0 && rental.depositStatus !== "Held") throw new Error("Confirm the deposit before collection");
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE rental_requests SET status = 'CheckedOut', checked_out_at = ?, updated_at = ? WHERE id = ?",
            ).bind(createdAt, createdAt, rental.id),
            env.DB.prepare(
              "UPDATE inventory_items SET available = available - ?, status = CASE WHEN available - ? <= 0 THEN 'Rented' ELSE status END WHERE id = ? AND business_id = ?",
            ).bind(rental.quantity, rental.quantity, listing.itemId, rental.ownerBusinessId),
            env.DB.prepare(
              "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, 'network_out', ?, 'Saída Trove Network', ?, ?)",
            ).bind(Date.now(), rental.ownerBusinessId, listing.itemId, -rental.quantity, context.userId, createdAt),
          ]);
        } else if (target === "Returned" && ["CheckedOut", "Disputed"].includes(rental.status) && rental.checkedOutAt && !rental.returnedAt) {
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE rental_requests SET status = 'Returned', returned_at = ?, updated_at = ? WHERE id = ?",
            ).bind(createdAt, createdAt, rental.id),
            env.DB.prepare(
              "UPDATE inventory_items SET available = MIN(quantity, available + ?), status = 'Available' WHERE id = ? AND business_id = ?",
            ).bind(rental.quantity, listing.itemId, rental.ownerBusinessId),
            env.DB.prepare(
              "INSERT INTO inventory_movements (id, business_id, item_id, type, quantity_delta, note, created_by_user_id, created_at) VALUES (?, ?, ?, 'network_return', ?, 'Devolução Trove Network', ?, ?)",
            ).bind(Date.now(), rental.ownerBusinessId, listing.itemId, rental.quantity, context.userId, createdAt),
          ]);
        } else if (target === "Completed" && rental.status === "Returned") {
          const unresolved = await env.DB.prepare(
            "SELECT id FROM rental_disputes WHERE rental_request_id = ? AND status != 'Resolved'",
          ).bind(rental.id).first();
          if (unresolved) throw new Error("Resolve the dispute before completion");
          if (rental.deposit > 0 && !["Returned", "Retained"].includes(rental.depositStatus)) {
            throw new Error("Resolve the deposit before completion");
          }
          await env.DB.prepare(
            "UPDATE rental_requests SET status = 'Completed', updated_at = ? WHERE id = ?",
          ).bind(createdAt, rental.id).run();
        } else {
          throw new Error("Invalid rental transition");
        }
      } else if (action === "reviewRental") {
        if (!["Returned", "Completed"].includes(rental.status)) throw new Error("Review is available after return");
        const unresolved = await env.DB.prepare(
          "SELECT id FROM rental_disputes WHERE rental_request_id = ? AND status != 'Resolved'",
        ).bind(rental.id).first();
        if (unresolved) throw new Error("Resolve the dispute before reviewing");
        const reviewedBusinessId = context.businessId === rental.ownerBusinessId
          ? rental.requesterBusinessId
          : rental.ownerBusinessId;
        await env.DB.prepare(
          "INSERT INTO rental_reviews (id, rental_request_id, reviewer_business_id, reviewed_business_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          integer(payload, "reviewId", { min: 1 }),
          rental.id,
          context.businessId,
          reviewedBusinessId,
          integer(payload, "rating", { min: 1, max: 5 }),
          text(payload, "comment", { max: 1000 }),
          createdAt,
        ).run();
      } else if (action === "openRentalDispute") {
        if (!["Accepted", "CheckedOut", "Returned"].includes(rental.status)) throw new Error("A dispute cannot be opened now");
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO rental_disputes (id, rental_request_id, opened_by_business_id, reason, status, proposed_resolution, created_at, updated_at) VALUES (?, ?, ?, ?, 'Open', '', ?, ?)",
          ).bind(
            integer(payload, "disputeId", { min: 1 }),
            rental.id,
            context.businessId,
            text(payload, "reason", { required: true, max: 2000 }),
            createdAt,
            createdAt,
          ),
          env.DB.prepare(
            "UPDATE rental_requests SET status = 'Disputed', updated_at = ? WHERE id = ?",
          ).bind(createdAt, rental.id),
        ]);
      } else if (action === "proposeDisputeResolution") {
        const dispute = await env.DB.prepare(
          "SELECT opened_by_business_id AS openedByBusinessId, status FROM rental_disputes WHERE rental_request_id = ?",
        ).bind(rental.id).first<{ openedByBusinessId: number; status: string }>();
        if (!dispute || !["Open", "Proposed"].includes(dispute.status)) throw new Error("Open dispute not found");
        if (context.businessId === dispute.openedByBusinessId) throw new Error("The counterparty must propose the resolution");
        await env.DB.prepare(
          "UPDATE rental_disputes SET status = 'Proposed', proposed_resolution = ?, proposed_by_business_id = ?, updated_at = ? WHERE rental_request_id = ?",
        ).bind(
          text(payload, "resolution", { required: true, max: 2000 }),
          context.businessId,
          createdAt,
          rental.id,
        ).run();
      } else if (action === "acceptDisputeResolution") {
        const dispute = await env.DB.prepare(
          "SELECT opened_by_business_id AS openedByBusinessId, status FROM rental_disputes WHERE rental_request_id = ?",
        ).bind(rental.id).first<{ openedByBusinessId: number; status: string }>();
        if (!dispute || dispute.status !== "Proposed") throw new Error("Proposed resolution not found");
        if (context.businessId !== dispute.openedByBusinessId) throw new Error("Only the business that opened the dispute can accept");
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE rental_disputes SET status = 'Resolved', resolved_at = ?, updated_at = ? WHERE rental_request_id = ?",
          ).bind(createdAt, createdAt, rental.id),
          env.DB.prepare(
            "UPDATE rental_requests SET status = CASE WHEN checked_out_at IS NOT NULL AND returned_at IS NULL THEN 'CheckedOut' ELSE 'Completed' END, updated_at = ? WHERE id = ?",
          ).bind(createdAt, rental.id),
        ]);
      }
      await audit(context.businessId, context.userId, action, rental.id, action.replace(/([A-Z])/g, " $1").trim(), createdAt);
    }

    if (requestForNotification) {
      const current = await getRentalRequest(requestForNotification.id);
      if (current) {
        const status = current.status;
        await notifyBoth(
          current,
          "Actualização na Trove Network",
          "Trove Network update",
          `O pedido #${current.id} está agora em ${status}.`,
          `Request #${current.id} is now ${status}.`,
          `network:${action}:${current.id}:${createdAt}`,
          createdAt,
        );
      }
    }
    return Response.json(result);
  } catch (error) {
    return clientError(error);
  }
}
