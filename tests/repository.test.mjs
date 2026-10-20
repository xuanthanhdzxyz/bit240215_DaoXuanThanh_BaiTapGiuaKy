import test from "node:test";
import assert from "node:assert/strict";
import {
  FoodRepository,
  TABLES,
  STORAGE_KEY,
  validEndpoint,
} from "../src/repository.js";
import { get, record } from "../src/domain.js";
function memory() {
  const values = new Map();
  return {
    values,
    async getItem(k) {
      return values.get(k) || null;
    },
    async setItem(k, v) {
      values.set(k, v);
    },
  };
}
function mockServer() {
  const tables = Object.fromEntries(Object.values(TABLES).map((t) => [t, []]));
  let lost = false;
  const request = async (url, options) => {
    const parts = new URL(url).pathname.split("/").filter(Boolean),
      table = parts[0],
      id = parts[1];
    if (!tables[table]) return { ok: false, status: 404 };
    if (options.method === "GET")
      return { ok: true, json: async () => structuredClone(tables[table]) };
    const data = JSON.parse(options.body);
    const row = { ...data, id: id || String(tables[table].length + 1) };
    if (id) tables[table] = tables[table].map((r) => (r.id === id ? row : r));
    else tables[table].push(row);
    if (lost) {
      lost = false;
      throw Error("lost response");
    }
    return { ok: true, json: async () => row };
  };
  return {
    tables,
    request,
    loseNext: () => {
      lost = true;
    },
  };
}
test("offline CRUD persists across restart; used categories and missing IDs are guarded", async () => {
  const storage = memory(),
    repo = new FoodRepository(storage);
  await repo.init();
  repo.setOnline(false);
  const d = record({
    Id: "offline",
    Name: "Offline dish",
    Price: 20,
    PreparationTime: 15,
    DishCategoryId: "main",
    IsAvailable: true,
    Description: "",
    DishImage: [],
  });
  await repo.saveDish(d);
  assert.equal(repo.snapshot().dishes.length, 6);
  await assert.rejects(repo.remove("categories", "main"), /inUse/);
  await assert.rejects(repo.remove("dishes", "missing"), /missing/);
  const restarted = new FoodRepository(storage);
  await restarted.init();
  restarted.setOnline(false);
  assert.ok(
    restarted.snapshot().dishes.some((r) => get(r, "Id") === "offline"),
  );
  await restarted.remove("dishes", "offline");
  assert.equal(restarted.snapshot().dishes.length, 5);
  assert.ok(
    [...storage.values.keys()].every((k) => k.startsWith("BIT240215_")),
  );
});
test("sync retries lost POST without duplicate, propagates edits and tombstones, pulls remote changes", async () => {
  const storage = memory(),
    server = mockServer(),
    repo = new FoodRepository(storage, server.request);
  await repo.init();
  repo.setOnline(false);
  await repo.endpoint("https://example.mockapi.io");
  repo.online = true;
  server.loseNext();
  await repo.sync();
  assert.equal(repo.status, "syncError");
  await repo.sync();
  assert.equal(repo.snapshot().pending, 0);
  assert.equal(server.tables[TABLES.categories].length, 3);
  assert.equal(server.tables[TABLES.dishes].length, 5);
  repo.setOnline(false);
  const d = repo.snapshot().dishes[0];
  await repo.saveDish({ ...d, ...record({ Price: 999 }) }, true);
  assert.ok(repo.snapshot().pending > 0);
  repo.online = true;
  await repo.sync();
  assert.equal(get(server.tables[TABLES.dishes][0], "Price"), 999);
  repo.setOnline(false);
  await repo.remove("dishes", get(d, "Id"));
  repo.online = true;
  await repo.sync();
  assert.equal(repo.snapshot().dishes.length, 4);
  assert.equal(
    get(
      server.tables[TABLES.dishes].find((r) => get(r, "Id") === get(d, "Id")),
      "Deleted",
    ),
    true,
  );
  server.tables[TABLES.dishes][1].BIT240215_Price = 777;
  await repo.sync();
  assert.equal(
    get(
      repo
        .snapshot()
        .dishes.find(
          (r) => get(r, "Id") === get(server.tables[TABLES.dishes][1], "Id"),
        ),
      "Price",
    ),
    777,
  );
  const restarted = new FoodRepository(storage, server.request);
  await restarted.init();
  await restarted.sync();
  assert.equal(server.tables[TABLES.dishes].length, 5);
});
test("failed storage write leaves in-memory and persisted data untouched", async () => {
  const storage = memory(),
    repo = new FoodRepository(storage);
  await repo.init();
  const before = storage.values.get(STORAGE_KEY);
  storage.setItem = async () => {
    throw Error("disk");
  };
  await assert.rejects(repo.remove("dishes", "d1"), /disk/);
  assert.equal(repo.snapshot().dishes.length, 5);
  assert.equal(storage.values.get(STORAGE_KEY), before);
});
test("rejects dashboard URL and invalid remote data; preserves local data on sync failure", async () => {
  assert.equal(validEndpoint("https://mockapi.io/projects/abc"), false);
  assert.equal(validEndpoint("https://abc.mockapi.io/api/v1"), true);
  const repo = new FoodRepository(memory(), async () => ({
    ok: true,
    json: async () => [{ id: "1", name: "wrong schema" }],
  }));
  await repo.init();
  repo.setOnline(false);
  await repo.endpoint("https://abc.mockapi.io");
  repo.online = true;
  await repo.sync();
  assert.equal(repo.status, "conflict");
  assert.equal(repo.snapshot().dishes.length, 5);
  assert.equal(repo.snapshot().pending, 8);
});

test("new installation pulls existing records instead of overwriting them with seed", async () => {
  const server = mockServer(),
    first = new FoodRepository(memory(), server.request);
  await first.init();
  await first.sync();
  first.setOnline(false);
  const dish = first.snapshot().dishes[0];
  await first.saveDish({ ...dish, ...record({ Price: 123456 }) }, true);
  first.online = true;
  await first.sync();
  const second = new FoodRepository(memory(), server.request);
  await second.init();
  await second.sync();
  assert.equal(
    get(
      second.snapshot().dishes.find((d) => get(d, "Id") === get(dish, "Id")),
      "Price",
    ),
    123456,
  );
  assert.equal(server.tables[TABLES.dishes].length, 5);
});

test("edit made while a request is in flight stays dirty and is sent on next automatic cycle", async () => {
  const server = mockServer();
  let release, started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  let block = false;
  const request = async (url, options) => {
    if (block && options.method === "PUT" && url.includes(TABLES.dishes)) {
      block = false;
      started();
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    return server.request(url, options);
  };
  const repo = new FoodRepository(memory(), request);
  await repo.init();
  await repo.sync();
  repo.setOnline(false);
  const dish = repo.snapshot().dishes[0];
  await repo.saveDish({ ...dish, ...record({ Price: 100 }) }, true);
  repo.online = true;
  block = true;
  const syncing = repo.sync();
  await began;
  await repo.saveDish({ ...dish, ...record({ Price: 200 }) }, true);
  release();
  await syncing;
  assert.equal(repo.snapshot().pending, 1);
  assert.equal(
    get(
      repo.snapshot().dishes.find((d) => get(d, "Id") === get(dish, "Id")),
      "Price",
    ),
    200,
  );
  await repo.sync();
  assert.equal(repo.snapshot().pending, 0);
  assert.equal(get(server.tables[TABLES.dishes][0], "Price"), 200);
});
