import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("the application has an explicit authenticated entry gate", async () => {
  const [page, auth] = await Promise.all([
    source("app/page.tsx"),
    source("app/chatgpt-auth.ts"),
  ]);

  assert.match(page, /getChatGPTUser/);
  assert.match(page, /chatGPTSignInPath/);
  assert.match(page, /Entrar com ChatGPT/);
  assert.match(page, /force-dynamic/);
  assert.match(auth, /getUserFromHeaders/);
  assert.match(auth, /oai-authenticated-user-email/);
});

test("data and upload routes enforce server-side authorization", async () => {
  const [data, itemImage, profileImage, workspace] = await Promise.all([
    source("app/api/data/route.ts"),
    source("app/api/item-image/route.ts"),
    source("app/api/profile-image/route.ts"),
    source("app/workspace.ts"),
  ]);

  assert.match(data, /ACTION_PERMISSIONS/);
  assert.match(data, /authorize\(request, permission\)/);
  assert.match(itemImage, /authorize\(request, "manageInventory"\)/);
  assert.match(profileImage, /authorize\(request, "manageProfile"\)/);
  assert.match(workspace, /UNAUTHENTICATED/);
  assert.match(workspace, /FORBIDDEN/);
  assert.match(workspace, /PERMISSIONS/);
});

test("tenant ownership is represented in schema, migration and queries", async () => {
  const [schema, migration, workspace, api] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0002_free_caretaker.sql"),
    source("app/workspace.ts"),
    source("app/api/data/route.ts"),
  ]);

  assert.match(schema, /export const businesses/);
  assert.match(schema, /export const memberships/);
  assert.ok((schema.match(/businessId:/g) ?? []).length >= 6);
  assert.match(migration, /CREATE TABLE `memberships`/);
  assert.match(migration, /ADD `business_id`/);
  assert.match(workspace, /createBusinessForUser/);
  assert.ok((api.match(/business_id = \?/g) ?? []).length >= 12);
});

test("real accounts start without client-side demo inventory", async () => {
  const app = await source("app/DecorApp.tsx");

  assert.match(app, /useState<Item\[]>\(\[\]\)/);
  assert.match(app, /useState<Reservation\[]>\(\[\]\)/);
  assert.doesNotMatch(app, /const seedItems/);
  assert.doesNotMatch(app, /const seedReservations/);
});
