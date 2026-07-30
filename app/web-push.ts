import { env } from "cloudflare:workers";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const encoder = new TextEncoder();

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concat(...values: Uint8Array[]) {
  const output = new Uint8Array(values.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

async function hmac(key: Uint8Array, value: Uint8Array) {
  const imported = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, value as BufferSource));
}

async function hkdfExtract(salt: Uint8Array, value: Uint8Array) {
  return hmac(salt, value);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const block = await hmac(prk, concat(info, new Uint8Array([1])));
  return block.slice(0, length);
}

export function webPushConfiguration() {
  return {
    publicKey: env.VAPID_PUBLIC_KEY?.trim() || "",
    privateKey: env.VAPID_PRIVATE_KEY?.trim() || "",
    subject: env.VAPID_SUBJECT?.trim() || "",
  };
}

async function vapidAuthorization(endpoint: string) {
  const config = webPushConfiguration();
  if (!config.publicKey || !config.privateKey || !config.subject) {
    throw new Error("WEB_PUSH_NOT_CONFIGURED");
  }
  const publicBytes = base64UrlToBytes(config.publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error("INVALID_VAPID_PUBLIC_KEY");
  }
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: config.privateKey,
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  })));
  const unsigned = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsigned),
  ));
  return `vapid t=${unsigned}.${bytesToBase64Url(signature)}, k=${config.publicKey}`;
}

async function encryptPayload(subscription: StoredSubscription, payload: PushPayload) {
  const userPublic = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);
  if (userPublic.length !== 65 || userPublic[0] !== 4 || authSecret.length < 16) {
    throw new Error("INVALID_PUSH_SUBSCRIPTION");
  }

  const userKey = await crypto.subtle.importKey(
    "raw",
    userPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: userKey },
    serverKeys.privateKey,
    256,
  ));
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const authPrk = await hkdfExtract(authSecret, sharedSecret);
  const ikm = await hkdfExpand(
    authPrk,
    concat(encoder.encode("WebPush: info"), new Uint8Array([0]), userPublic, serverPublic),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const contentKey = await hkdfExpand(
    prk,
    concat(encoder.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    concat(encoder.encode("Content-Encoding: nonce"), new Uint8Array([0])),
    12,
  );
  const key = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const plaintext = concat(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    plaintext,
  ));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, encrypted);
}

async function deliver(subscription: StoredSubscription, payload: PushPayload) {
  const body = await encryptPayload(subscription, payload);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body,
  });
  if (response.status === 404 || response.status === 410) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(subscription.id).run();
    return false;
  }
  if (!response.ok) throw new Error(`PUSH_DELIVERY_${response.status}`);
  return true;
}

export async function sendPushToUsers(userIds: number[], payload: PushPayload) {
  const config = webPushConfiguration();
  if (!config.publicKey || !config.privateKey || !config.subject || !userIds.length) {
    return { delivered: 0, failed: 0 };
  }
  const placeholders = userIds.map(() => "?").join(",");
  const subscriptions = await env.DB.prepare(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE enabled = 1 AND user_id IN (${placeholders})`,
  ).bind(...userIds).all<StoredSubscription>();
  const results = await Promise.allSettled(
    subscriptions.results.map((subscription) => deliver(subscription, payload)),
  );
  return {
    delivered: results.filter((result) => result.status === "fulfilled" && result.value).length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
