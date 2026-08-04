import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";

type EnvKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID";

const readEnv = (key: EnvKey): string | undefined => {
  const raw = (import.meta.env[key] as string | undefined)?.trim();
  return raw ? raw : undefined;
};

const required: EnvKey[] = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

const missing: EnvKey[] = required.filter((k) => !readEnv(k));

export const isFirebaseConfigured = missing.length === 0;
export const missingFirebaseKeys: string[] = missing;

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let functionsInstance: Functions | null = null;

if (isFirebaseConfigured) {
  appInstance = initializeApp({
    apiKey: readEnv("VITE_FIREBASE_API_KEY")!,
    authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN")!,
    projectId: readEnv("VITE_FIREBASE_PROJECT_ID")!,
    storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET")!,
    messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID")!,
    appId: readEnv("VITE_FIREBASE_APP_ID")!,
  });
  dbInstance = getFirestore(appInstance);
  authInstance = getAuth(appInstance);
  functionsInstance = getFunctions(appInstance);
}

const notConfigured = () => {
  throw new Error(
    "Firebase mijozi sozlanmagan. Yetishmayotgan: " + missing.join(", "),
  );
};

const proxy = <T>(): T =>
  new Proxy({}, { get: notConfigured, apply: notConfigured }) as unknown as T;

export const firebaseApp: FirebaseApp = appInstance ?? proxy<FirebaseApp>();
export const db: Firestore = dbInstance ?? proxy<Firestore>();
export const auth: Auth = authInstance ?? proxy<Auth>();
export const functions: Functions = functionsInstance ?? proxy<Functions>();
