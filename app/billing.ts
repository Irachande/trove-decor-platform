import { env } from "cloudflare:workers";

export type BillingPlan = "Basic" | "Network";
export type SubscriptionStatus =
  | "Trialing"
  | "Active"
  | "Grace"
  | "PastDue"
  | "Cancelled";

export const PLAN_CATALOG: Record<BillingPlan, {
  amount: number;
  currency: "MZN";
  collaboratorLimit: number | null;
  network: boolean;
}> = {
  Basic: {
    amount: 1200,
    currency: "MZN",
    collaboratorLimit: 3,
    network: false,
  },
  Network: {
    amount: 3100,
    currency: "MZN",
    collaboratorLimit: null,
    network: true,
  },
};

type BillingEnv = {
  PAYSUITE_API_TOKEN?: string;
  PAYSUITE_WEBHOOK_SECRET?: string;
  PAYSUITE_API_URL?: string;
};

export function parsePlan(value: unknown): BillingPlan {
  if (value === "Basic" || value === "Network") return value;
  throw new Error("Invalid subscription plan");
}

export function subscriptionAllowsWrites(
  status: string,
  currentPeriodEnd: string,
  graceUntil?: string | null,
  at = new Date(),
) {
  const now = at.toISOString();
  if (status === "Trialing" || status === "Active") {
    return !currentPeriodEnd || currentPeriodEnd > now;
  }
  return status === "Grace" && Boolean(graceUntil && graceUntil > now);
}

export function paymentConfiguration() {
  const values = env as unknown as BillingEnv;
  return {
    apiToken: values.PAYSUITE_API_TOKEN?.trim() || "",
    webhookSecret: values.PAYSUITE_WEBHOOK_SECRET?.trim() || "",
    apiUrl:
      values.PAYSUITE_API_URL?.trim().replace(/\/$/, "") ||
      "https://paysuite.tech/api/v1",
  };
}

export async function createPaySuitePayment(input: {
  amount: number;
  reference: string;
  description: string;
  returnUrl: string;
  callbackUrl: string;
}) {
  const config = paymentConfiguration();
  if (!config.apiToken) {
    throw new Error("PAYMENTS_NOT_CONFIGURED");
  }
  const response = await fetch(`${config.apiUrl}/payments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      reference: input.reference,
      description: input.description.slice(0, 125),
      return_url: input.returnUrl,
      callback_url: input.callbackUrl,
    }),
  });
  const body = await response.json().catch(() => ({})) as {
    message?: string;
    data?: {
      id?: string;
      checkout_url?: string;
      status?: string;
    };
  };
  if (!response.ok || !body.data?.id || !body.data.checkout_url) {
    throw new Error(body.message || "Unable to create PaySuite payment");
  }
  const checkout = new URL(body.data.checkout_url);
  if (checkout.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(checkout.hostname)) {
    throw new Error("Invalid checkout URL returned by payment provider");
  }
  return {
    providerPaymentId: body.data.id,
    checkoutUrl: checkout.toString(),
    status: body.data.status || "pending",
  };
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyPaySuiteSignature(
  rawBody: string,
  signature: string,
) {
  const secret = paymentConfiguration().webhookSecret;
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );
  const supplied = hexToBytes(signature.trim().toLowerCase());
  if (!supplied || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    difference |= supplied[index] ^ expected[index];
  }
  return difference === 0;
}

function bytesToHex(value: Uint8Array) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/.test(value) || value.length % 2) return null;
  return Uint8Array.from(
    value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [],
  );
}
