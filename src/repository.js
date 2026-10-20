import { get, key, record, seed, uid, validateDish } from "./domain.js";
import { DEFAULT_ENDPOINT } from "./config.js";

export const STORAGE_KEY = key("Database");
export const TABLES = { categories: key("DishCategory"), dishes: key("Dish") };
export function validEndpoint(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      /^([a-z0-9-]+\.)+mockapi\.io$/i.test(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}
const live = (rows) => rows.filter((r) => !get(r, "Deleted"));
const clean = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([k]) =>
        k.startsWith("BIT240215_") &&
        !["Dirty", "Revision", "RemoteId", "Seed"].some((n) => k === key(n)),
    ),
  );
const fresh = (row) => ({
  ...row,
  ...record({ Dirty: true, Revision: uid(), Deleted: false, Seed: true }),
});
// A single persisted envelope makes data + outbox updates atomic on AsyncStorage.
// Every write is serialized. An HTTP acknowledgment only clears the exact revision sent.
export class FoodRepository {
  constructor(storage, request = (...args) => fetch(...args)) {
    this.storage = storage;
    this.request = request;
    this.listeners = new Set();
    this.chain = Promise.resolve();
    this.running = false;
    this.status = "local";
    this.online = true;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    this.listeners.forEach((fn) => fn());
  }
  async init() {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        !Array.isArray(parsed[TABLES.categories]) ||
        !Array.isArray(parsed[TABLES.dishes])
      )
        throw Error("invalidData");
      this.db = parsed;
    } else {
      const s = seed();
      this.db = {
        ...record({
          Language: "en",
          Endpoint: DEFAULT_ENDPOINT,
          SchemaVersion: 1,
        }),
        [TABLES.categories]: s.categories.map(fresh),
        [TABLES.dishes]: s.dishes.map(fresh),
      };
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    }
    this.emit();
  }
  snapshot() {
    if (!this.db) return null;
    return {
      categories: live(this.db[TABLES.categories]),
      dishes: live(this.db[TABLES.dishes]),
      lang: get(this.db, "Language"),
      endpoint: get(this.db, "Endpoint"),
      pending: Object.values(TABLES)
        .flatMap((t) => this.db[t])
        .filter((r) => get(r, "Dirty")).length,
      status: this.status,
      online: this.online,
    };
  }
  transaction(change) {
    const work = this.chain.then(async () => {
      const next = JSON.parse(JSON.stringify(this.db));
      const result = change(next);
      await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      this.db = next;
      this.emit();
      return result;
    });
    this.chain = work.catch(() => {});
    return work;
  }
  async language(lang) {
    await this.transaction((db) => {
      db[key("Language")] = lang;
    });
  }
  async endpoint(value) {
    const base = value.trim().replace(/\/+$/, "");
    if (!validEndpoint(base)) throw Error("badEndpoint");
    await this.transaction((db) => {
      if (get(db, "Endpoint") === base) return;
      db[key("Endpoint")] = base;
      // New target has independent server IDs; all local records must be reconciled.
      Object.values(TABLES).forEach((t) => {
        db[t] = db[t].map((r) => ({
          ...r,
          ...record({ Dirty: true, Revision: uid(), RemoteId: null }),
        }));
      });
    });
    void this.sync();
  }
  async saveDish(dish, editing = false) {
    await this.transaction((db) => {
      const rows = db[TABLES.dishes],
        id = get(dish, "Id");
      if (editing && !live(rows).some((r) => get(r, "Id") === id))
        throw Error("missing");
      const error = validateDish(dish, live(db[TABLES.categories]), live(rows));
      if (error) throw Error(error);
      const old = rows.find((r) => get(r, "Id") === id);
      const updated = {
        ...old,
        ...dish,
        ...record({
          Name: get(dish, "Name").trim(),
          Dirty: true,
          Seed: false,
          Revision: uid(),
          Deleted: false,
        }),
      };
      db[TABLES.dishes] = old
        ? rows.map((r) => (get(r, "Id") === id ? updated : r))
        : [...rows, updated];
    });
    void this.sync();
  }
  async saveCategory(category, editing = false) {
    await this.transaction((db) => {
      if (!get(category, "Name")?.trim()) throw Error("required");
      const rows = db[TABLES.categories],
        id = get(category, "Id"),
        old = rows.find((r) => get(r, "Id") === id && !get(r, "Deleted"));
      if (editing && !old) throw Error("missing");
      const updated = {
        ...old,
        ...category,
        ...record({
          Name: get(category, "Name").trim(),
          Dirty: true,
          Seed: false,
          Revision: uid(),
          Deleted: false,
        }),
      };
      db[TABLES.categories] = old
        ? rows.map((r) => (get(r, "Id") === id ? updated : r))
        : [...rows, updated];
    });
    void this.sync();
  }
  async remove(type, id) {
    await this.transaction((db) => {
      if (!live(db[TABLES[type]]).some((r) => get(r, "Id") === id))
        throw Error("missing");
      if (
        type === "categories" &&
        live(db[TABLES.dishes]).some((r) => get(r, "DishCategoryId") === id)
      )
        throw Error("inUse");
      db[TABLES[type]] = db[TABLES[type]].map((r) =>
        get(r, "Id") === id
          ? {
              ...r,
              ...record({
                Deleted: true,
                Dirty: true,
                Seed: false,
                Revision: uid(),
              }),
            }
          : r,
      );
    });
    void this.sync();
  }
  setOnline(online) {
    this.online = online;
    if (!online) this.status = "offline";
    this.emit();
    if (online) void this.sync();
  }
  async http(path, method = "GET", body) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.request(path, {
        method,
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw Error("syncError");
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async sync() {
    if (this.running || !this.db || !this.online) return;
    const base = get(this.db, "Endpoint");
    if (!base) {
      this.status = "local";
      this.emit();
      return;
    }
    this.running = true;
    this.status = "syncing";
    this.emit();
    try {
      const remote = {};
      // Fetch complete tables (no pagination) before sending. Stable app IDs survive lost POST responses.
      for (const type of ["categories", "dishes"]) {
        const rows = await this.http(`${base}/${TABLES[type]}`);
        if (!Array.isArray(rows)) throw Error("conflict");
        if (
          rows.some(
            (r) => !get(r, "Id") || typeof get(r, "Deleted") !== "boolean",
          )
        )
          throw Error("conflict");
        if (new Set(rows.map((r) => get(r, "Id"))).size !== rows.length)
          throw Error("conflict");
        remote[type] = rows;
      }
      for (const type of ["categories", "dishes"]) {
        const dirty = this.db[TABLES[type]].filter((r) => get(r, "Dirty"));
        for (const row of dirty) {
          const existing = remote[type].find(
            (r) => get(r, "Id") === get(row, "Id"),
          );
          // Installing on a second device must not overwrite an existing server
          // record with untouched demo data. Actual offline edits still win.
          if (existing && get(row, "Seed")) {
            await this.transaction((db) => {
              if (get(db, "Endpoint") !== base) return;
              db[TABLES[type]] = db[TABLES[type]].map((r) =>
                get(r, "Id") === get(row, "Id") &&
                get(r, "Revision") === get(row, "Revision")
                  ? { ...r, ...record({ Dirty: false }) }
                  : r,
              );
            });
            continue;
          }
          const path = `${base}/${TABLES[type]}${existing ? "/" + encodeURIComponent(existing.id) : ""}`;
          const response = await this.http(
            path,
            existing ? "PUT" : "POST",
            clean(row),
          );
          if (get(response, "Id") !== get(row, "Id")) throw Error("conflict");
          remote[type] = remote[type]
            .filter((r) => get(r, "Id") !== get(row, "Id"))
            .concat(response);
          await this.transaction((db) => {
            if (get(db, "Endpoint") !== base) return;
            db[TABLES[type]] = db[TABLES[type]].map((r) =>
              get(r, "Id") === get(row, "Id") &&
              get(r, "Revision") === get(row, "Revision")
                ? { ...r, ...record({ Dirty: false, RemoteId: response.id }) }
                : r,
            );
          });
        }
      }
      await this.transaction((db) => {
        if (get(db, "Endpoint") !== base) return;
        const merged = {};
        for (const type of ["categories", "dishes"]) {
          const local = db[TABLES[type]],
            incoming = remote[type].map((r) => ({
              ...clean(r),
              ...record({ Dirty: false, RemoteId: r.id, Revision: uid() }),
            }));
          // Local edits made while sync is running always win until the next push.
          merged[type] = incoming
            .filter(
              (r) =>
                !local.some(
                  (l) => get(l, "Id") === get(r, "Id") && get(l, "Dirty"),
                ),
            )
            .concat(local.filter((l) => get(l, "Dirty")));
        }
        const cats = live(merged.categories),
          dishes = live(merged.dishes);
        if (
          cats.some((c) => !get(c, "Name")?.trim()) ||
          dishes.some((d) => validateDish(d, cats, dishes))
        )
          throw Error("conflict");
        db[TABLES.categories] = merged.categories;
        db[TABLES.dishes] = merged.dishes;
      });
      this.status = this.snapshot().pending ? "syncing" : "synced";
    } catch (error) {
      this.status = error.message === "conflict" ? "conflict" : "syncError";
    } finally {
      this.running = false;
      this.emit();
    }
  }
}
