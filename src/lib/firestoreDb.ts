import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

type WithId<T> = T & { id: string };

const mapDoc = <T>(snap: QueryDocumentSnapshot<DocumentData>): WithId<T> =>
  ({ id: snap.id, ...(snap.data() as T) }) as WithId<T>;

export type OrderSpec = [string, "asc" | "desc"];

export type ListOptions = {
  orderBy?: OrderSpec | OrderSpec[];
};

const buildOrder = (spec?: OrderSpec | OrderSpec[]): QueryConstraint[] => {
  if (!spec) return [];
  const arr = Array.isArray(spec[0]) ? (spec as OrderSpec[]) : [spec as OrderSpec];
  return arr.map(([f, d]) => orderBy(f, d));
};

// The big shared collections are read whole by nearly every page. Instead
// of downloading all of them again on each page, one live listener per
// collection is kept for the session: the first page pays for the download,
// later pages get the rows at once, and only changed documents come over
// the wire after that. Own writes show up immediately (latency compensation).
const SHARED = new Set([
  "orders",
  "order_products",
  "order_payments",
  "order_costs",
  "customers",
  "products",
  "product_costs",
  "expenses",
]);

type Hub = {
  rows: WithId<DocumentData>[] | null;
  ready: Promise<WithId<DocumentData>[]>;
  subscribers: Set<(rows: WithId<DocumentData>[]) => void>;
  stop: () => void;
};
const hubs = new Map<string, Hub>();

const openHub = (name: string): Hub => {
  const existing = hubs.get(name);
  if (existing) return existing;
  let resolve!: (rows: WithId<DocumentData>[]) => void;
  let reject!: (err: unknown) => void;
  const ready = new Promise<WithId<DocumentData>[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  ready.catch(() => undefined);
  const hub: Hub = { rows: null, ready, subscribers: new Set(), stop: () => undefined };
  hubs.set(name, hub);
  hub.stop = onSnapshot(
    collection(db, name),
    (snap) => {
      hub.rows = snap.docs.map((d) => mapDoc<DocumentData>(d));
      resolve(hub.rows);
      hub.subscribers.forEach((fn) => fn(hub.rows!));
    },
    (err) => {
      // No access (or signed out): forget the listener so the next call
      // asks again instead of serving nothing forever.
      console.error(`Firestore ${name}:`, err);
      if (hubs.get(name) === hub) hubs.delete(name);
      reject(err);
    },
  );
  return hub;
};

// Opens the listeners ahead of time (right after sign-in), so the first
// page that needs the data finds it already loaded.
export const warmCollections = (names: string[]): void => {
  for (const n of names) if (SHARED.has(n)) openHub(n);
};

// Rows of a shared collection already in memory, or null when not loaded yet.
const loadedRows = (name: string): WithId<DocumentData>[] | null => (SHARED.has(name) ? hubs.get(name)?.rows ?? null : null);

// Called when the signed-in user changes — another user may see other data.
export const resetCollectionCache = (): void => {
  hubs.forEach((h) => h.stop());
  hubs.clear();
};

// Firestore's order: by type first, then by value; a query ordered by a
// field leaves out documents that do not have it.
const typeRank = (v: unknown): number =>
  v === null ? 0 : typeof v === "boolean" ? 1 : typeof v === "number" ? 2 : typeof v === "string" ? 4 : typeof (v as { toMillis?: unknown }).toMillis === "function" ? 3 : 5;
const compareValues = (a: unknown, b: unknown): number => {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 3) return (a as { toMillis: () => number }).toMillis() - (b as { toMillis: () => number }).toMillis();
  if (ra === 5) return 0;
  return a! < b! ? -1 : a! > b! ? 1 : 0;
};
const arrange = <T>(rows: WithId<DocumentData>[], spec?: OrderSpec | OrderSpec[]): WithId<T>[] => {
  if (!spec) return rows.slice() as WithId<T>[];
  const arr = Array.isArray(spec[0]) ? (spec as OrderSpec[]) : [spec as OrderSpec];
  return rows
    .filter((r) => arr.every(([f]) => r[f] !== undefined))
    .sort((a, b) => {
      for (const [f, dir] of arr) {
        const c = compareValues(a[f], b[f]);
        if (c) return dir === "desc" ? -c : c;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    }) as WithId<T>[];
};

export const listAll = async <T>(
  name: string,
  options?: ListOptions,
): Promise<WithId<T>[]> => {
  if (SHARED.has(name)) {
    const hub = openHub(name);
    return arrange<T>(hub.rows ?? (await hub.ready), options?.orderBy);
  }
  const constraints = buildOrder(options?.orderBy);
  const q = constraints.length
    ? query(collection(db, name), ...constraints)
    : collection(db, name);
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc<T>(d));
};

export const listWhere = async <T>(
  name: string,
  field: string,
  value: unknown,
  options?: ListOptions,
): Promise<WithId<T>[]> => {
  // Already in memory: no round trip (plain values compare like "==").
  const rows = loadedRows(name);
  if (rows && (value === null || typeof value !== "object")) return arrange<T>(rows.filter((r) => r[field] === value), options?.orderBy);
  const constraints: QueryConstraint[] = [where(field, "==", value), ...buildOrder(options?.orderBy)];
  const snap = await getDocs(query(collection(db, name), ...constraints));
  return snap.docs.map((d) => mapDoc<T>(d));
};

export type Unsubscribe = () => void;

// Documents whose `field` lies between `from` and `to`, both included —
// e.g. attendance by dateCode for a period.
export const listRange = async <T>(name: string, field: string, from: string, to: string): Promise<WithId<T>[]> => {
  const snap = await getDocs(query(collection(db, name), where(field, ">=", from), where(field, "<=", to)));
  return snap.docs.map((d) => mapDoc<T>(d));
};

export const subscribeAll = <T>(
  name: string,
  onData: (rows: WithId<T>[]) => void,
  options?: ListOptions,
): Unsubscribe => {
  if (SHARED.has(name)) {
    const hub = openHub(name);
    const fn = (rows: WithId<DocumentData>[]) => onData(arrange<T>(rows, options?.orderBy));
    hub.subscribers.add(fn);
    if (hub.rows) fn(hub.rows);
    return () => {
      hub.subscribers.delete(fn);
    };
  }
  const constraints = buildOrder(options?.orderBy);
  const q = constraints.length
    ? query(collection(db, name), ...constraints)
    : collection(db, name);
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => mapDoc<T>(d)));
  });
};

export const subscribeWhere = <T>(
  name: string,
  field: string,
  value: unknown,
  onData: (rows: WithId<T>[]) => void,
  options?: ListOptions,
  onError?: (err: Error) => void,
): Unsubscribe => {
  const constraints: QueryConstraint[] = [where(field, "==", value), ...buildOrder(options?.orderBy)];
  const q = query(collection(db, name), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapDoc<T>(d)));
    },
    onError,
  );
};

export const subscribeOne = <T>(
  name: string,
  id: string,
  onData: (row: WithId<T> | null) => void,
): Unsubscribe =>
  onSnapshot(doc(db, name, id), (snap) => {
    onData(snap.exists() ? ({ id: snap.id, ...(snap.data() as T) } as WithId<T>) : null);
  });

export const getOne = async <T>(
  name: string,
  id: string,
): Promise<WithId<T> | null> => {
  const rows = loadedRows(name);
  if (rows) return (rows.find((r) => r.id === id) as WithId<T> | undefined) ?? null;
  const snap = await getDoc(doc(db, name, id));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as T) } as WithId<T>) : null;
};

const stamp = (data: Record<string, unknown>) => {
  const out = { ...data };
  if (!("created_at" in out)) out.created_at = new Date().toISOString();
  return out;
};

export const insertOne = async <T extends Record<string, unknown>>(
  name: string,
  data: T,
): Promise<WithId<T>> => {
  const payload = stamp(data);
  const ref = await addDoc(collection(db, name), payload);
  return { id: ref.id, ...(payload as T) } as WithId<T>;
};

export const upsertOne = async <T extends Record<string, unknown>>(
  name: string,
  id: string,
  data: T,
): Promise<WithId<T>> => {
  const payload = stamp(data);
  await setDoc(doc(db, name, id), payload, { merge: true });
  return { id, ...(payload as T) } as WithId<T>;
};

export const updateOne = async (
  name: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> => {
  await updateDoc(doc(db, name, id), data);
};

export const deleteOne = async (name: string, id: string): Promise<void> => {
  await deleteDoc(doc(db, name, id));
};

export const deleteWhere = async (
  name: string,
  field: string,
  value: unknown,
): Promise<void> => {
  const snap = await getDocs(query(collection(db, name), where(field, "==", value)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

export const insertMany = async <T extends Record<string, unknown>>(
  name: string,
  rows: T[],
): Promise<void> => {
  if (rows.length === 0) return;
  const batch = writeBatch(db);
  for (const row of rows) {
    const ref = doc(collection(db, name));
    batch.set(ref, stamp(row));
  }
  await batch.commit();
};

export const updateWhere = async (
  name: string,
  field: string,
  value: unknown,
  patch: Record<string, unknown>,
): Promise<void> => {
  const snap = await getDocs(query(collection(db, name), where(field, "==", value)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, patch));
  await batch.commit();
};

export const countWhere = async (
  name: string,
  field: string,
  value: unknown,
): Promise<number> => {
  const snap = await getDocs(query(collection(db, name), where(field, "==", value)));
  return snap.size;
};
