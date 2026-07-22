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

export const listAll = async <T>(
  name: string,
  options?: ListOptions,
): Promise<WithId<T>[]> => {
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
  const constraints: QueryConstraint[] = [where(field, "==", value), ...buildOrder(options?.orderBy)];
  const snap = await getDocs(query(collection(db, name), ...constraints));
  return snap.docs.map((d) => mapDoc<T>(d));
};

export const getOne = async <T>(
  name: string,
  id: string,
): Promise<WithId<T> | null> => {
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
