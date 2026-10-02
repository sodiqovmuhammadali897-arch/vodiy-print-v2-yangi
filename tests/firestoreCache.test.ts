import { beforeEach, describe, expect, it, vi } from "vitest";

// One fake listener per collection; tests push snapshots through it.
const listeners = new Map<string, { next: (snap: unknown) => void; error: (e: unknown) => void; stopped: boolean }>();
const getDocs = vi.fn(async () => ({ docs: [] }));

vi.mock("../src/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: (...a: unknown[]) => getDocs(...(a as [])),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: (c: unknown) => c,
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: (ref: { name: string }, next: (s: unknown) => void, error: (e: unknown) => void) => {
    const l = { next, error, stopped: false };
    listeners.set(ref.name, l);
    return () => {
      l.stopped = true;
    };
  },
}));

const snap = (rows: Record<string, unknown>[]) => ({ docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) });

const load = async () => {
  vi.resetModules();
  listeners.clear();
  getDocs.mockClear();
  return import("../src/lib/firestoreDb");
};

describe("shared collection cache", () => {
  let db: Awaited<ReturnType<typeof load>>;
  beforeEach(async () => {
    db = await load();
  });

  it("downloads a shared collection once and serves later reads from memory", async () => {
    const first = db.listAll("orders");
    listeners.get("orders")!.next(snap([{ id: "a", n: 1 }]));
    expect(await first).toEqual([{ id: "a", n: 1 }]);
    expect(await db.listAll("orders")).toEqual([{ id: "a", n: 1 }]);
    expect(listeners.size).toBe(1);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it("sorts like Firestore and leaves out rows without the field", async () => {
    const p = db.listAll("orders", { orderBy: ["created_at", "desc"] });
    listeners.get("orders")!.next(snap([{ id: "a", created_at: "2026-09-01" }, { id: "b" }, { id: "c", created_at: "2026-10-01" }]));
    expect((await p).map((r) => r.id)).toEqual(["c", "a"]);
  });

  it("pushes changes to subscribers and stops only their callback", async () => {
    const seen: string[][] = [];
    const stop = db.subscribeAll<{ position: number }>("order_products", (rows) => seen.push(rows.map((r) => r.id)), { orderBy: ["position", "asc"] });
    const l = listeners.get("order_products")!;
    l.next(snap([{ id: "x", position: 2 }, { id: "y", position: 1 }]));
    l.next(snap([{ id: "x", position: 2 }]));
    stop();
    l.next(snap([]));
    expect(seen).toEqual([["y", "x"], ["x"]]);
    expect(l.stopped).toBe(false);
  });

  it("asks again after an error and after the user changes", async () => {
    const p = db.listAll("customers");
    listeners.get("customers")!.error(new Error("permission-denied"));
    await expect(p).rejects.toThrow("permission-denied");
    const again = db.listAll("customers");
    listeners.get("customers")!.next(snap([{ id: "k" }]));
    expect(await again).toEqual([{ id: "k" }]);

    const old = listeners.get("customers")!;
    db.resetCollectionCache();
    expect(old.stopped).toBe(true);
    const fresh = db.listAll("customers");
    expect(listeners.get("customers")).not.toBe(old);
    listeners.get("customers")!.next(snap([]));
    expect(await fresh).toEqual([]);
  });

  it("answers lookups from memory once a collection is loaded", async () => {
    // Not loaded yet: straight to the server.
    await db.listWhere("order_products", "product_name", "Paket");
    expect(getDocs).toHaveBeenCalledTimes(1);
    db.warmCollections(["order_products", "tasks"]);
    expect(listeners.has("tasks")).toBe(false);
    listeners.get("order_products")!.next(snap([{ id: "a", product_name: "Paket", position: 2 }, { id: "b", product_name: "Kitob" }, { id: "c", product_name: "Paket", position: 1 }]));
    expect((await db.listWhere("order_products", "product_name", "Paket", { orderBy: ["position", "asc"] })).map((r) => r.id)).toEqual(["c", "a"]);
    expect(await db.getOne("order_products", "b")).toEqual({ id: "b", product_name: "Kitob" });
    expect(await db.getOne("order_products", "zz")).toBeNull();
    expect(getDocs).toHaveBeenCalledTimes(1);
  });

  it("reads other collections straight from the server", async () => {
    await db.listAll("tasks");
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(listeners.has("tasks")).toBe(false);
  });
});
