import { createHash } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { db } from "./admin";
import { RP_ID, RP_NAME, ORIGIN } from "./config";
import { requireStaffEmail, staffFullName } from "./authGuard";
import { saveChallenge, consumeChallenge } from "./challengeStore";
import { base64urlToUint8Array } from "./lib/base64url";
import type { StoredCredential } from "./types";

// The WebAuthn userID just needs to be a stable opaque handle per account —
// it must never leak the email itself into the authenticator's storage.
const userIdFor = (email: string): string =>
  createHash("sha256").update(email).digest("hex");

export const webauthnRegisterOptions = onCall(async (request) => {
  const email = await requireStaffEmail(request);
  const fullName = await staffFullName(email);

  const existing = await db
    .collection("webauthn_credentials")
    .where("employeeEmail", "==", email)
    .get();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: userIdFor(email),
    userName: email,
    userDisplayName: fullName,
    attestationType: "none",
    excludeCredentials: existing.docs.map((d) => ({
      id: base64urlToUint8Array(d.data().credentialId as string),
      type: "public-key" as const,
      transports: d.data().transports as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  await saveChallenge(email, options.challenge, "register");
  return options;
});

export const webauthnRegisterVerify = onCall(async (request) => {
  const email = await requireStaffEmail(request);
  const { response, deviceName } = (request.data || {}) as {
    response: RegistrationResponseJSON;
    deviceName?: string;
  };
  if (!response) {
    throw new HttpsError("invalid-argument", "Tasdiqlash ma'lumoti yetishmayapti");
  }

  const expectedChallenge = await consumeChallenge(email, "register");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new HttpsError("permission-denied", "Tasdiqlash muvaffaqiyatsiz bo'ldi");
  }

  const { credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;
  const fullName = await staffFullName(email);
  const now = new Date().toISOString();

  const record: StoredCredential = {
    employeeEmail: email,
    employeeName: fullName,
    credentialId: response.id,
    publicKey: Buffer.from(credentialPublicKey).toString("base64"),
    counter,
    deviceName: deviceName?.trim() || null,
    transports: response.response.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    createdAt: now,
    lastUsedAt: null,
  };

  await db.collection("webauthn_credentials").doc(response.id).set(record);

  return { ok: true, credentialId: response.id };
});
